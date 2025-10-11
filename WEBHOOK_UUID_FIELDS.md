# Webhook API: UUID-Based Field Structure Implementation

## ✅ Final Fix Applied

The webhook API now creates objects and records using **UUID-based field keys** that match your app's data structure exactly.

## How Fields Work in Your App

### Object Fields (basicFields)
Objects store fields using **UUID keys directly**:
```javascript
{
  "docId": "object_1760207065648_sipz8q102",
  "linkId": "object_1760207065648_sipz8q102",
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Test Name",  // ← UUID key
  "8be27931-d708-4a10-8b49-f8ee81f79741": "Test Address", // ← UUID key
  "assignedTo": "nick.fikatas@gmail.com",
  "history": [
    {
      "field": "f378a3ea-4b84-4415-82cb-bdbc02607bae", // ← References UUID
      "value": "Test Name",
      "timestamp": Timestamp,
      "modifiedBy": "businessId",
      "isObject": true
    }
  ]
}
```

### Record Fields (basicFields + templateFields)
Records store fields with **UUID keys directly** (no prefix):
```javascript
{
  "docId": "record_1760207080198_89ofx9iw0",
  "linkId": "object_1760207065648_sipz8q102",
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick", // ← UUID only (basicField)
  "8be27931-d708-4a10-8b49-f8ee81f79741": "Raktivan", // ← UUID only (basicField)
  "0a8e854d-a096-469b-ae34-0cee045a2e0a": "100", // ← UUID only (templateField)
  "history": [
    {
      "field": "f378a3ea-4b84-4415-82cb-bdbc02607bae", // ← UUID only
      "value": "Nick",
      "timestamp": Timestamp,
      "modifiedBy": "businessId"
    }
  ]
}
```

## Field Mapping in Workflow Builder

When configuring a workflow, users map form fields to CRM fields using a dropdown that shows:
- **Object Fields**: "Name (Object Field)" → `basicFields.f378a3ea-4b84-4415-82cb-bdbc02607bae`
- **Template Fields**: "Score (Template Field)" → `templateFields.0a8e854d-a096-469b-ae34-0cee045a2e0a`

**Important**: The prefixes (`basicFields.` and `templateFields.`) are ONLY for the UI selection. The actual data stored in Firestore uses **UUID keys only** without any prefix.

## How the Cloud Function Processes This

### Step 1: Parse Field Mappings
```javascript
for (const mapping of fieldMappings) {
  const { formField, crmField } = mapping;
  // formField: "Full Name" (from website form)
  // crmField: "basicFields.f378a3ea-4b84-4415-82cb-bdbc02607bae"
  
  let value = formData[formField]; // Get value from form
  
  if (crmField.startsWith('basicFields.')) {
    const fieldUuid = crmField.replace('basicFields.', '');
    // fieldUuid: "f378a3ea-4b84-4415-82cb-bdbc02607bae"
    
    // For BOTH object and record: UUID only (no prefix)
    objectFields[fieldUuid] = value;
    recordFields[fieldUuid] = value;
  } else if (crmField.startsWith('templateFields.')) {
    const fieldUuid = crmField.replace('templateFields.', '');
    // templateFields only go in records (UUID only)
    recordFields[fieldUuid] = value;
  }
}
```

### Step 2: Create Object with UUID Keys
```javascript
const objectData = {
  docId: objectId,
  linkId: objectId,
  typeOfObject: "Customer",
  isObject: true,
  records: [],
  history: [
    {
      field: "f378a3ea-4b84-4415-82cb-bdbc02607bae", // UUID only
      value: "Test Name",
      timestamp: now,
      modifiedBy: businessId,
      isObject: true
    }
  ],
  lastModifiedBy: businessId,
  assignedTo: "user@example.com",
  lastModified: "2025-10-11T18:24:43.419Z",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // Spread UUID fields
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Test Name",
  "8be27931-d708-4a10-8b49-f8ee81f79741": "Test Address"
};
```

### Step 3: Create Record with UUID Keys
```javascript
const recordData = {
  docId: recordId,
  linkId: objectId,
  typeOfRecord: "Lead",
  typeOfObject: "Customer",
  isObject: false,
  history: [
    {
      field: "f378a3ea-4b84-4415-82cb-bdbc02607bae", // UUID only
      value: "Nick",
      timestamp: now,
      modifiedBy: businessId
    },
    {
      field: "0a8e854d-a096-469b-ae34-0cee045a2e0a", // UUID only
      value: 100,
      timestamp: now,
      modifiedBy: businessId
    }
  ],
  assignedTo: "user@example.com",
  lastModifiedBy: businessId,
  sheetName: "Customer Leads",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // Spread UUID fields (no prefixes)
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick",
  "8be27931-d708-4a10-8b49-f8ee81f79741": "Raktivan",
  "0a8e854d-a096-469b-ae34-0cee045a2e0a": 100
};
```

## Why This Structure?

### basicFields (Object-Level Data)
- Defined in `templateObjects` collection
- Represents core entity information (name, email, address)
- Shared across all records of this object
- Stored with **UUID keys only** in both objects and records
- No prefix in storage, only in UI selection

### templateFields (Record-Level Data)
- Defined in specific record templates
- Represents record-specific information (score, status, notes)
- Unique to each record type
- Only stored in records with **UUID keys only**
- No prefix in storage, only in UI selection

## Smart Object Deduplication

The function tries to find existing objects by:
1. **Email field** (if any basicField contains an @ symbol)
2. **First field value** (fallback)

This prevents duplicate objects for the same entity.

## Complete Example

### Form Submission
```json
POST /submitFormData?workflowId=workflow_123
{
  "Full Name": "Nick",
  "Address": "123 Main St",
  "Score": "100"
}
```

### Workflow Config
```json
{
  "mapping": {
    "objectType": "Customer",
    "fieldMappings": [
      {
        "formField": "Full Name",
        "crmField": "basicFields.f378a3ea-4b84-4415-82cb-bdbc02607bae",
        "required": true
      },
      {
        "formField": "Address",
        "crmField": "basicFields.8be27931-d708-4a10-8b49-f8ee81f79741",
        "required": false
      },
      {
        "formField": "Score",
        "crmField": "templateFields.0a8e854d-a096-469b-ae34-0cee045a2e0a",
        "required": false
      }
    ]
  }
}
```

### Created Object
```json
{
  "docId": "object_1760207065648_sipz8q102",
  "linkId": "object_1760207065648_sipz8q102",
  "typeOfObject": "Customer",
  "isObject": true,
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick",
  "8be27931-d708-4a10-8b49-f8ee81f79741": "123 Main St",
  "assignedTo": "",
  "lastModifiedBy": "businessId",
  "lastModified": "2025-10-11T18:24:43.419Z",
  "records": [
    {
      "docId": "record_1760207080198_89ofx9iw0",
      "typeOfRecord": "Lead"
    }
  ],
  "history": [
    {
      "field": "f378a3ea-4b84-4415-82cb-bdbc02607bae",
      "value": "Nick",
      "timestamp": Timestamp,
      "modifiedBy": "businessId",
      "isObject": true
    },
    {
      "field": "8be27931-d708-4a10-8b49-f8ee81f79741",
      "value": "123 Main St",
      "timestamp": Timestamp,
      "modifiedBy": "businessId",
      "isObject": true
    }
  ],
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

### Created Record
```json
{
  "docId": "record_1760207080198_89ofx9iw0",
  "linkId": "object_1760207065648_sipz8q102",
  "typeOfRecord": "Lead",
  "typeOfObject": "Customer",
  "isObject": false,
  "f378a3ea-4b84-4415-82cb-bdbc02607bae": "Nick",
  "8be27931-d708-4a10-8b49-f8ee81f79741": "123 Main St",
  "0a8e854d-a096-469b-ae34-0cee045a2e0a": "100",
  "assignedTo": "",
  "lastModifiedBy": "businessId",
  "sheetName": "Customer Leads",
  "history": [
    {
      "field": "f378a3ea-4b84-4415-82cb-bdbc02607bae",
      "value": "Nick",
      "timestamp": Timestamp,
      "modifiedBy": "businessId"
    },
    {
      "field": "8be27931-d708-4a10-8b49-f8ee81f79741",
      "value": "123 Main St",
      "timestamp": Timestamp,
      "modifiedBy": "businessId"
    },
    {
      "field": "0a8e854d-a096-469b-ae34-0cee045a2e0a",
      "value": "100",
      "timestamp": Timestamp,
      "modifiedBy": "businessId"
    }
  ],
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

## Testing

After deployment, objects and records created via webhook will:
- ✅ Use UUID keys for all fields (matching app format)
- ✅ Have UUID-only keys in objects (no prefix)
- ✅ Have UUID-only keys in records (no prefix)
- ✅ Display correctly in your app's UI
- ✅ Work with all existing app features (editing, history, relationships)

## UI Changes

- ✅ Removed "Sheet Name" option from workflow configuration (uses template's sheetName instead)
- ✅ SheetName is automatically determined from the selected template

## Key Changes Made

1. **Field Processing**: Extract UUID from `basicFields.UUID` and `templateFields.UUID`
2. **Object Creation**: Store with UUID keys only (no prefix)
3. **Record Creation**: Store with UUID keys only (no prefix)
4. **History Tracking**: Use UUID keys only for both objects and records
5. **Deduplication**: Query by UUID field values
6. **SheetName**: Automatically determined from template (removed manual input)
7. **TypeOfRecord**: Uses template name instead of objectType

---

**Status**: ✅ Deployed and Ready
**Last Updated**: October 11, 2025
