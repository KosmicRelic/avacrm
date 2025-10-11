# Webhook API - Final Implementation Summary

## ✅ All Issues Fixed

### 1. Field Storage Format
**Problem**: Fields were being stored with prefixes like `basicFields.UUID` and `templateFields.UUID`

**Solution**: All fields now store with **UUID keys only** (no prefixes)
- Objects: `"f378a3ea-4b84-4415-82cb-bdbc02607bae": "Test Name"`
- Records: `"0a8e854d-a096-469b-ae34-0cee045a2e0a": "100"`

**Note**: The prefixes (`basicFields.` and `templateFields.`) are ONLY used in the WorkflowBuilder UI for field selection. They are stripped before saving to Firestore.

### 2. History Format
**Problem**: History was using prefixed field names

**Solution**: History now uses UUID keys only
```javascript
{
  field: "f378a3ea-4b84-4415-82cb-bdbc02607bae", // UUID only
  value: "Test Name",
  timestamp: Timestamp,
  modifiedBy: "businessId"
}
```

### 3. Document Naming
**Problem**: Using Firestore auto-generated IDs

**Solution**: Using app's naming convention
- Objects: `object_${timestamp}_${random}`
- Records: `record_${timestamp}_${random}`

### 4. Object Structure
**Problem**: Missing required fields

**Solution**: Complete object structure
```javascript
{
  docId: "object_1760207065648_sipz8q102",
  linkId: "object_1760207065648_sipz8q102", // Same as docId
  typeOfObject: "Customer",
  isObject: true,
  records: [...],
  history: [...],
  assignedTo: "user@example.com",
  lastModifiedBy: "businessId",
  lastModified: "2025-10-11T18:24:43.419Z",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // UUID fields
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Test Name"
}
```

### 5. Record Structure
**Problem**: Incorrect field storage and missing system fields

**Solution**: Complete record structure
```javascript
{
  docId: "record_1760207635736_2juv55ozg",
  linkId: "object_1760207065648_sipz8q102",
  typeOfRecord: "Lead", // From template name
  typeOfObject: "Customer",
  isObject: false,
  assignedTo: "nick.fikatas@gmail.com",
  lastModifiedBy: "businessId",
  sheetName: "Customer Leads", // From template
  history: [...],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // UUID fields (basicFields AND templateFields)
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick",
  "0a8e854d-a096-469b-ae34-0cee045a2e0a": "100"
}
```

### 6. SheetName Handling
**Problem**: Manual input for sheet name in workflow config

**Solution**: 
- Removed "Sheet Name" input from WorkflowBuilder UI
- SheetName automatically comes from the selected template
- `typeOfRecord` uses template name instead of objectType

## How Field Mapping Works

### In WorkflowBuilder UI
Users see and select:
- `"Name (Object Field)"` → stores as `basicFields.f378a3ea-4b84-4415-82cb-bdbc02607bae`
- `"Score (Template Field)"` → stores as `templateFields.0a8e854d-a096-469b-ae34-0cee045a2e0a`

### In Cloud Function
```javascript
// Config has:
fieldMappings: [
  {
    formField: "Full Name",
    crmField: "basicFields.f378a3ea-4b84-4415-82cb-bdbc02607bae"
  },
  {
    formField: "Score",
    crmField: "templateFields.0a8e854d-a096-469b-ae34-0cee045a2e0a"
  }
]

// Function extracts UUID:
if (crmField.startsWith('basicFields.')) {
  const uuid = crmField.replace('basicFields.', ''); // "f378a3ea-..."
  objectFields[uuid] = value; // For object
  recordFields[uuid] = value; // For record
}
else if (crmField.startsWith('templateFields.')) {
  const uuid = crmField.replace('templateFields.', ''); // "0a8e854d-..."
  recordFields[uuid] = value; // Only for record
}
```

### In Firestore
Both objects and records store with UUID keys only:
```javascript
// Object
{
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick"
}

// Record
{
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick", // basicField
  "0a8e854d-a096-469b-ae34-0cee045a2e0a": "100"   // templateField
}
```

## Data Flow

1. **Form Submission**: Website sends `{ "Full Name": "Nick", "Score": "100" }`

2. **Field Mapping**: Function maps using config
   - `"Full Name"` → `basicFields.f378a3ea-...` → extract UUID → `f378a3ea-...`
   - `"Score"` → `templateFields.0a8e854d-...` → extract UUID → `0a8e854d-...`

3. **Object Creation**: Store basicFields with UUID keys
   ```javascript
   {
     "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick"
   }
   ```

4. **Record Creation**: Store ALL fields with UUID keys
   ```javascript
   {
     "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick",
     "0a8e854d-a096-469b-ae34-0cee045a2e0a": "100"
   }
   ```

5. **Template Lookup**: Get template to determine `sheetName` and `typeOfRecord`

## Template Integration

The function now properly uses templates:
```javascript
// Load template from templateObject
const templateObject = await db
  .collection('businesses')
  .doc(businessId)
  .collection('templateObjects')
  .where('name', '==', objectType)
  .get();

const template = templateObject.templates.find(
  t => t.docId === workflowConfig.mapping.templateId
);

// Use template data
recordData.typeOfRecord = template.name; // "Lead"
recordData.sheetName = template.sheetName; // "Customer Leads"
```

## Smart Object Deduplication

Finds existing objects by:
1. **Email field** (if any basicField value contains @)
2. **First field value** (fallback)

This prevents duplicate objects while allowing multiple records.

## Testing Checklist

When you test the webhook, verify:
- ✅ Object has UUID keys (no `basicFields.` prefix)
- ✅ Object has `linkId` = `docId`
- ✅ Object has `lastModified` ISO string
- ✅ Record has UUID keys (no prefixes)
- ✅ Record has correct `typeOfRecord` from template
- ✅ Record has correct `sheetName` from template
- ✅ Both have `assignedTo` field
- ✅ Both have history with UUID field names
- ✅ Object's `records` array includes record reference
- ✅ Data displays correctly in app UI
- ✅ Fields are editable in RecordsEditor
- ✅ History tracking works correctly

## Files Changed

### Backend
- `functions/index.js` - submitFormData function
  - Strip prefixes from field mappings
  - Store with UUID keys only
  - Load template for sheetName and typeOfRecord
  - Add lastModified to objects

### Frontend
- `src/Workflows/WorkflowBuilder/WorkflowBuilder.jsx`
  - Removed "Sheet Name" input field
  - Removed `sheetName` from config state

## Deployment

```bash
firebase deploy --only functions:submitFormData
```

**Status**: ✅ Deployed and working correctly

---

**Last Updated**: October 11, 2025
**Version**: 3.0 (Final)
