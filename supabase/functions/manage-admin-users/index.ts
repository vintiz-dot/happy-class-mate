import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, password, userId } = await req.json();

    console.log('Action requested:', action);

    // Special actions that don't require authentication
    if (action === 'checkAdmins') {
      console.log('Checking if admin users exist');
      const { count, error: countError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (countError) {
        console.error('Error checking for admins:', countError);
        return new Response(JSON.stringify({ error: countError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Admin count:', count);
      return new Response(JSON.stringify({ hasAdmins: (count ?? 0) > 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'bootstrap') {
      console.log('Bootstrap action requested - checking if admins exist');
      
      // Check if any admins exist
      const { count, error: countError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (countError) {
        console.error('Error checking for admins:', countError);
        return new Response(JSON.stringify({ error: countError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((count ?? 0) > 0) {
        console.log('Bootstrap denied: Admin users already exist');
        return new Response(JSON.stringify({ 
          error: 'Bootstrap denied: Admin users already exist' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create the test admin user
      const testEmail = 'test@admin.com';
      const testPassword = 'abcabc!';

      console.log('Creating bootstrap admin user:', testEmail);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });

      if (createError) {
        console.error('Error creating bootstrap admin user:', createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Bootstrap admin user created, assigning admin role');

      // Assign admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: 'admin',
        });

      if (roleError) {
        console.error('Error assigning admin role:', roleError);
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log the bootstrap action
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert({
          action: 'bootstrap_admin',
          entity: 'user',
          entity_id: newUser.user.id,
          diff: { email: testEmail, role: 'admin' },
        });

      if (auditError) {
        console.error('Error logging bootstrap action:', auditError);
      }

      console.log('Bootstrap admin created successfully');
      return new Response(JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        email: testEmail 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All other actions require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if requester is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Not admin:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'listUsers') {
      // List all users with their admin status
      console.log('Listing all users');
      
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return new Response(JSON.stringify({ error: rolesError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);

      const usersWithRoles = (authUsers.users || []).map(u => ({
        id: u.id,
        email: u.email || '',
        created_at: u.created_at,
        isAdmin: adminIds.has(u.id)
      }));

      console.log(`Listed ${usersWithRoles.length} users`);

      return new Response(JSON.stringify({ users: usersWithRoles }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'create') {
      // Create new admin user
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create user with service role (bypasses email confirmation)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'admin' }
      });

      if (createError) {
        console.error('Create user error:', createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert admin role
      const { error: roleInsertError } = await supabase
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: 'admin' });

      if (roleInsertError) {
        console.error('Role insert error:', roleInsertError);
        return new Response(JSON.stringify({ error: roleInsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Audit log
      await supabase.from('audit_log').insert({
        actor_user_id: user.id,
        action: 'create_admin',
        entity: 'user',
        entity_id: newUser.user.id,
        diff: { email, role: 'admin' }
      });

      console.log('Admin user created:', email);

      return new Response(JSON.stringify({ 
        success: true, 
        user: { id: newUser.user.id, email: newUser.user.email }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'promote') {
      // Promote existing user to admin
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user already has admin role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      if (existingRole) {
        return new Response(JSON.stringify({ error: 'User is already an admin' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert admin role
      const { error: roleInsertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });

      if (roleInsertError) {
        console.error('Role insert error:', roleInsertError);
        return new Response(JSON.stringify({ error: roleInsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update users table
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', userId);

      if (updateError) {
        console.error('User update error:', updateError);
      }

      // Audit log
      await supabase.from('audit_log').insert({
        actor_user_id: user.id,
        action: 'promote_to_admin',
        entity: 'user',
        entity_id: userId,
        diff: { role: 'admin' }
      });

      console.log('User promoted to admin:', userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'revoke') {
      // Revoke admin role
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Prevent self-revocation
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot revoke your own admin role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete admin role
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (deleteError) {
        console.error('Role delete error:', deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Audit log
      await supabase.from('audit_log').insert({
        actor_user_id: user.id,
        action: 'revoke_admin',
        entity: 'user',
        entity_id: userId,
        diff: { role_removed: 'admin' }
      });

      console.log('Admin role revoked:', userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
