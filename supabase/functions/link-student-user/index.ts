import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LinkSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  userId: z.string().uuid('Invalid user ID'),
  action: z.literal('link'),
  updateFamilyEmail: z.boolean().optional().default(true),
  allowReassign: z.boolean().optional().default(false),
});

const UnlinkSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  action: z.literal('unlink'),
});

const RequestSchema = z.union([LinkSchema, UnlinkSchema]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate and parse request
    const body = await req.json();
    const validated = RequestSchema.parse(body);

    if (validated.action === 'unlink') {
      // Get student info for audit log
      const { data: student } = await supabase
        .from('students')
        .select('full_name, linked_user_id')
        .eq('id', validated.studentId)
        .single();

      if (!student?.linked_user_id) {
        return new Response(JSON.stringify({ 
          error: 'Student is not currently linked to any user' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Unlink user from student
      const { error: unlinkError } = await supabase
        .from('students')
        .update({ linked_user_id: null })
        .eq('id', validated.studentId);

      if (unlinkError) throw unlinkError;

      // Audit log
      await supabase.from('audit_log').insert({
        entity: 'student',
        entity_id: validated.studentId,
        action: 'unlink_user',
        actor_user_id: user.id,
        diff: { 
          old_user_id: student.linked_user_id,
          student_name: student.full_name
        }
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link action - get user email for family update
    const { data: authUser, error: userFetchError } = await supabase.auth.admin.getUserById(validated.userId);
    if (userFetchError || !authUser.user) {
      return new Response(JSON.stringify({ 
        error: 'User not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userEmail = authUser.user.email;

    // Check if user is already linked to another student
    const { data: existingLink } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('linked_user_id', validated.userId)
      .maybeSingle();

    if (existingLink && existingLink.id !== validated.studentId) {
      if (!validated.allowReassign) {
        return new Response(JSON.stringify({ 
          error: `User is already linked to ${existingLink.full_name}. Enable "Reassign" to proceed.`,
          requiresReassign: true,
          currentStudent: existingLink.full_name
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Unlink from previous student first
      await supabase
        .from('students')
        .update({ linked_user_id: null })
        .eq('id', existingLink.id);

      await supabase.from('audit_log').insert({
        entity: 'student',
        entity_id: existingLink.id,
        action: 'unlink_user',
        actor_user_id: user.id,
        diff: { 
          reason: 'reassigned',
          old_student_name: existingLink.full_name,
          new_student_id: validated.studentId
        }
      });
    }

    // Get student with family info
    const { data: student } = await supabase
      .from('students')
      .select('id, full_name, family_id, family:families(id, name, primary_user_id, email)')
      .eq('id', validated.studentId)
      .single();

    if (!student) {
      return new Response(JSON.stringify({ 
        error: 'Student not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link user to student
    const { error: linkError } = await supabase
      .from('students')
      .update({ linked_user_id: validated.userId })
      .eq('id', validated.studentId);

    if (linkError) throw linkError;

    // Ensure user has 'student' role
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', validated.userId)
      .maybeSingle();

    if (!existingRole) {
      await supabase
        .from('user_roles')
        .insert({ user_id: validated.userId, role: 'student' });
    }

    let emailWarning = null;

    // Handle family information update
    if (validated.updateFamilyEmail && student.family_id) {
      const family = Array.isArray(student.family) ? student.family[0] : student.family;
      
      if (family) {
        const currentEmail = family.email;
        
        if (!currentEmail || currentEmail.trim() === '') {
          // Update family with user's email
          await supabase
            .from('families')
            .update({ email: userEmail })
            .eq('id', family.id);

          await supabase.from('audit_log').insert({
            entity: 'family',
            entity_id: family.id,
            action: 'update_email',
            actor_user_id: user.id,
            diff: { 
              old_email: null,
              new_email: userEmail,
              reason: 'student_linked'
            }
          });
        } else if (currentEmail !== userEmail) {
          // Email exists but differs - return warning
          emailWarning = `Family email is "${currentEmail}" but linked user email is "${userEmail}". Consider updating manually if needed.`;
        }
      }
    } else if (validated.updateFamilyEmail && !student.family_id) {
      // Student has no family - create one
      const { data: newFamily, error: familyError } = await supabase
        .from('families')
        .insert({
          name: `${student.full_name}'s Family`,
          email: userEmail,
          primary_user_id: validated.userId,
          created_by: user.id
        })
        .select()
        .single();

      if (!familyError && newFamily) {
        // Link student to new family
        await supabase
          .from('students')
          .update({ family_id: newFamily.id })
          .eq('id', validated.studentId);

        await supabase.from('audit_log').insert({
          entity: 'family',
          entity_id: newFamily.id,
          action: 'create',
          actor_user_id: user.id,
          diff: { 
            reason: 'auto_created_for_student',
            student_id: validated.studentId,
            student_name: student.full_name
          }
        });
      }
    }

    // Final audit log for link
    await supabase.from('audit_log').insert({
      entity: 'student',
      entity_id: validated.studentId,
      action: 'link_user',
      actor_user_id: user.id,
      diff: { 
        user_id: validated.userId,
        user_email: userEmail,
        student_name: student.full_name,
        updated_family_email: validated.updateFamilyEmail
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      warning: emailWarning
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request data',
        details: error.errors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to link/unlink user. Please try again.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
