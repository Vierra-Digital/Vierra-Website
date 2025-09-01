# Temporary Admin Credentials

This document describes the temporary admin system for development/testing purposes.

## Quick Setup

### Create Temporary Admin
```bash
npm run create-temp-admin
```

### Remove Temporary Admin
```bash
npm run remove-temp-admin
```

## Credentials

**Email:** `temp-admin@vierradev.com`  
**Password:** `TempAdmin2024!`

## Features

- ✅ Easy to create and remove
- ✅ Clearly marked as temporary
- ✅ Full admin privileges
- ✅ Safe to use in development

## Security Notes

⚠️ **IMPORTANT:** These credentials are for development/testing only!

- The email `temp-admin@vierradev.com` is clearly marked as temporary
- Easy to identify and remove
- Should never be used in production
- Automatically checks if already exists before creating

## Manual Removal

If the script doesn't work, you can manually remove the user from the database:

```sql
DELETE FROM users WHERE email = 'temp-admin@vierradev.com';
```

## Files Created

- `scripts/create-temp-admin.ts` - Creates the temporary admin
- `scripts/remove-temp-admin.ts` - Removes the temporary admin
- `TEMP_ADMIN_README.md` - This documentation file

## NPM Scripts Added

- `npm run create-temp-admin` - Creates temporary admin
- `npm run remove-temp-admin` - Removes temporary admin
