
# Fix: Homework Files "Bucket Not Found" Error

## Problem

The `homework` storage bucket is private (for security), but the frontend code uses `getPublicUrl()` which only works for public buckets. This results in a 404 "Bucket not found" error when users try to view/download homework files.

## Solution

Replace `getPublicUrl()` calls with `createSignedUrl()` for private bucket access. Signed URLs are temporary authenticated URLs that respect RLS policies.

## Files to Update

| File | Current Issue |
|------|--------------|
| `src/components/teacher/AssignmentUpload.tsx` | Line 215: Uses `getPublicUrl()` |
| `src/components/admin/class/ClassHomework.tsx` | Line 134: Uses `getPublicUrl()` |

## Implementation

### 1. Update `AssignmentUpload.tsx`

**Before (line 213-219):**
```typescript
const viewFile = async (storageKey: string) => {
  try {
    const { data } = await supabase.storage.from("homework").getPublicUrl(storageKey);
    window.open(data.publicUrl, "_blank");
  } catch (error: any) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  }
};
```

**After:**
```typescript
const viewFile = async (storageKey: string) => {
  try {
    const { data, error } = await supabase.storage
      .from("homework")
      .createSignedUrl(storageKey, 3600); // 1 hour expiry
    
    if (error) throw error;
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  } catch (error: any) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  }
};
```

### 2. Update `ClassHomework.tsx`

**Before (line 133-136):**
```typescript
const getFileUrl = (storageKey: string) => {
  const { data } = supabase.storage.from("homework").getPublicUrl(storageKey);
  return data.publicUrl;
};
```

**After:**
```typescript
const openFile = async (storageKey: string) => {
  try {
    const { data, error } = await supabase.storage
      .from("homework")
      .createSignedUrl(storageKey, 3600); // 1 hour expiry
    
    if (error) throw error;
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  } catch (error: any) {
    toast({ title: "Error opening file", description: error.message, variant: "destructive" });
  }
};
```

Also update any calls to `getFileUrl()` to use the new async `openFile()` function.

## Technical Notes

- **Signed URL expiry**: 3600 seconds (1 hour) is a good balance between security and usability
- **RLS policies**: Already configured to allow:
  - Teachers: View all homework files
  - Admins: Full access
  - Students: View files for their enrolled classes + own submissions
- **No bucket changes needed**: The bucket should remain private for security

## Verification

After the fix:
1. Teachers can click to view uploaded assignment files
2. Students can download teacher attachments
3. Admins can view all homework files
4. No more 404 "Bucket not found" errors
