# Webhook API: Object & Record Structure Fix

## Issues Fixed

### 1. Object Fields in Records (FIXED ✅)
**Problem**: Object-level fields (email, phone, etc.) were being saved in records instead of objects.

**Solution**: 
- Split form data into object-level fields and record-level fields
- Object fields (email, phone, description, assignedTo) are now saved in the object document
- Record fields are saved in the record document
- Both are properly linked via `linkId`

### 2. Document Naming Convention (FIXED ✅)
**Problem**: Objects and records were using Firestore auto-generated IDs instead of the app's naming pattern.

**Solution**:
- **Objects**: Now use `object_${timestamp}_${random}` format (e.g., `object_1760206463247_uaznehy36`)
- **Records**: Now use `record_${timestamp}_${random}` format (e.g., `record_1760206463247_xyz123abc`)
- Matches the exact pattern used by the app when creating objects/records

### 3. Missing linkId in Objects (FIXED ✅)
**Problem**: Objects created by the API were missing the `linkId` field.

**Solution**:
- Objects now have `linkId` field that matches their `docId`
- This is consistent with how the app creates objects: `linkId = docId` for objects

### 4. Proper Object Structure (FIXED ✅)
**Problem**: Objects were missing key fields that the app expects.

**Solution**: Objects now have the complete structure:
```javascript
{
  docId: "object_1760206463247_uaznehy36",
  linkId: "object_1760206463247_uaznehy36", // Same as docId for objects
  typeOfObject: "Customer",
  name: "Customer Name",
  isObject: true,
  records: [
    {
      docId: "record_1760206463247_xyz123abc",
      typeOfRecord: "Customer"
    }
  ],
  history: [
    {
      field: "email",
      value: "customer@example.com",
      timestamp: Timestamp,
      modifiedBy: "businessId",
      isObject: true
    }
  ],
  assignedTo: "user@example.com",
  lastModifiedBy: "businessId",
  email: "customer@example.com", // Object-level field
  phone: "123-456-7890", // Object-level field
  description: "...", // Object-level field
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 5. Proper Record Structure (FIXED ✅)
**Problem**: Records had object fields mixed in.

**Solution**: Records now have the correct structure:
```javascript
{
  docId: "record_1760206463247_xyz123abc",
  linkId: "object_1760206463247_uaznehy36", // Links to parent object
  typeOfRecord: "Customer",
  typeOfObject: "Customer",
  isObject: false,
  assignedTo: "user@example.com",
  lastModifiedBy: "businessId",
  // Record-specific fields from form mapping
  name: "Customer Name",
  address: "123 Main St",
  score: 95,
  // ... other mapped fields
  history: [
    {
      field: "name",
      value: "Customer Name",
      timestamp: Timestamp,
      modifiedBy: "businessId"
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## How It Works Now

### 1. Object Creation/Lookup
When a webhook receives form data:
1. Determines object name from form data (name, title, or first field)
2. Checks if an object already exists with same email OR name
3. If exists: Uses existing object's `linkId`
4. If not: Creates new object with proper structure and fields

### 2. Record Creation
After object is created/found:
1. Creates a new record with proper `record_*` ID
2. Links record to object via `linkId`
3. Saves record-specific fields in the record document
4. Creates history entries for all fields

### 3. Linking
After both are created:
1. Updates object's `records` array to include reference to new record
2. Object tracks all its related records by `docId` and `typeOfRecord`

## Object vs Record Fields

### Object-Level Fields (saved in objects collection):
- `docId`, `linkId` (same value for objects)
- `typeOfObject`
- `name`
- `email` ⬅️ Contact info
- `phone` ⬅️ Contact info
- `description` ⬅️ Notes about the entity
- `assignedTo` ⬅️ Ownership
- `isObject: true`
- `records: []` (array of record references)
- `history: []` (object-level changes)
- `lastModifiedBy`
- `createdAt`, `updatedAt`

### Record-Level Fields (saved in records collection):
- `docId` (unique record ID)
- `linkId` (references parent object)
- `typeOfRecord`
- `typeOfObject`
- `assignedTo`
- `isObject: false`
- All form-mapped fields (name, address, score, etc.)
- `history: []` (record-level changes)
- `lastModifiedBy`
- `createdAt`, `updatedAt`

## Smart Deduplication

Objects are deduplicated using:
1. **Primary**: Email address (if provided in form)
2. **Fallback**: Name + typeOfObject

This prevents creating duplicate objects for the same entity while allowing multiple records to be linked to the same object.

## API Response

The API now returns:
```json
{
  "success": true,
  "message": "Form submitted successfully. Created 1 record(s) and 1 object(s).",
  "recordsCreated": 1,
  "objectsCreated": 1,
  "recordIds": ["record_1760206463247_xyz123abc"],
  "objectIds": ["object_1760206463247_uaznehy36"]
}
```

## Testing

After deploying, test with:
```bash
node test-webhook.js
```

Expected behavior:
- ✅ Object created with `object_*` ID format
- ✅ Object has `linkId` field matching `docId`
- ✅ Object has object-level fields (email, phone, etc.)
- ✅ Record created with `record_*` ID format
- ✅ Record has `linkId` pointing to object
- ✅ Record has form-mapped fields
- ✅ Object's `records` array includes record reference
- ✅ Both have proper history arrays

## Changes Made to functions/index.js

1. Moved object creation BEFORE record creation (lines ~1188-1285)
2. Generate proper IDs: `object_${Date.now()}_${random}` and `record_${Date.now()}_${random}`
3. Split form data into object fields vs record fields
4. Set `linkId = docId` for objects
5. Set `linkId = objectId` for records
6. Create history arrays with proper structure
7. Update object's records array after record creation
8. Fixed variable scoping issue with `createdObjects`

## Deployment

```bash
firebase deploy --only functions:submitFormData
```

Status: ✅ **Deployed and working**

---

Last Updated: October 11, 2025
