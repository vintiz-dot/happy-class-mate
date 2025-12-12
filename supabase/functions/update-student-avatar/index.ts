import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to get user ID
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    // Create service role client to bypass RLS
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find the student linked to this user (direct link or via family)
    let student = null;
    
    // First try direct link
    const { data: directStudent } = await serviceClient
      .from('students')
      .select('id, avatar_url, full_name')
      .eq('linked_user_id', user.id)
      .maybeSingle();
    
    if (directStudent) {
      student = directStudent;
      console.log('Found directly linked student:', student.full_name);
    } else {
      // Check if user is a family primary user
      const { data: family } = await serviceClient
        .from('families')
        .select('id')
        .eq('primary_user_id', user.id)
        .maybeSingle();
      
      if (family) {
        console.log('Found family for user:', family.id);
        
        // Get first student in the family
        const { data: familyStudents } = await serviceClient
          .from('students')
          .select('id, avatar_url, full_name')
          .eq('family_id', family.id)
          .limit(1);
        
        if (familyStudents && familyStudents.length > 0) {
          student = familyStudents[0];
          console.log('Found family student:', student.full_name);
        }
      }
    }

    if (!student) {
      console.error('No student found for user:', user.id);
      return new Response(JSON.stringify({ error: 'No student profile linked to this account. Please contact an administrator to link your account.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found student:', student.id);

    // Parse form data to get the file
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'File must be an image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File must be less than 5MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('File validated:', file.name, file.type, file.size);

    // Delete old avatar if exists
    if (student.avatar_url) {
      try {
        // Extract path from URL - handle both full URLs and relative paths
        const url = new URL(student.avatar_url);
        const pathMatch = url.pathname.match(/student-avatars\/(.+)$/);
        if (pathMatch) {
          const oldPath = pathMatch[1];
          console.log('Deleting old avatar:', oldPath);
          await serviceClient.storage.from('student-avatars').remove([oldPath]);
        }
      } catch (e) {
        console.log('Could not parse old avatar URL, skipping delete:', e);
      }
    }

    // Upload new avatar
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${student.id}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from('student-avatars')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('File uploaded:', filePath);

    // Get public URL
    const { data: { publicUrl } } = serviceClient.storage
      .from('student-avatars')
      .getPublicUrl(filePath);

    console.log('Public URL:', publicUrl);

    // Update student record with new avatar URL
    const { error: updateError } = await serviceClient
      .from('students')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', student.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Student record updated successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      avatarUrl: publicUrl,
      studentId: student.id 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
