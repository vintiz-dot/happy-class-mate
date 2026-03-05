

## Problem

After publishing an assignment, the form fields visually retain previous content even though state is reset. The root cause is **ReactQuill** — it doesn't reliably clear its internal editor state when the controlled `value` is reset to `""`. The Select component for class may also retain its visual state.

## Fix

Add a `formKey` counter (similar to the existing `fileInputKey` pattern) and use it as a `key` on the entire form. When the form key increments on successful publish, React unmounts and remounts all form elements, guaranteeing a clean slate.

### File: `src/components/teacher/AssignmentUpload.tsx`

1. Add a `formKey` state: `const [formKey, setFormKey] = useState(0);`
2. In the `onSuccess` callback (line 176), increment it: `setFormKey(prev => prev + 1);`
3. Add `key={formKey}` to the `<form>` element (line 244) — this forces React to fully remount the form including ReactQuill and Select components
4. Remove the separate `fileInputKey` state since the form-level key handles it

This is a minimal, safe fix — one new state variable, one key prop, zero risk to existing behavior.

