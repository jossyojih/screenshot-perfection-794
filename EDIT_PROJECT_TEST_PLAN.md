# Edit Project Dialog - Manual Test Plan

## Test Cases

### 1. Opening and Closing Dialog

- [ ] Click "Edit project" button in Project Details section
- [ ] Dialog opens with current project name and description pre-filled
- [ ] Click "Cancel" button - dialog closes without changes
- [ ] Click outside dialog (backdrop) - dialog closes without changes
- [ ] Click X button (if present) - dialog closes without changes
- [ ] After closing, reopen dialog - fields are reset to current project values

### 2. Validation Tests

- [ ] Clear project name field - "Save" button is disabled
- [ ] Enter only whitespace in name field - "Save" button is disabled
- [ ] Enter valid name - "Save" button is enabled
- [ ] Submit with empty name - validation error "Project name is required" appears
- [ ] Clear validation error by typing valid name

### 3. Editing Name

- [ ] Change project name to "Updated Project Name"
- [ ] Click "Save"
- [ ] Loading state appears: "Saving changes..." with spinner
- [ ] Success message appears: "Project updated successfully"
- [ ] Click "Done" - dialog closes
- [ ] Project Detail header shows updated name
- [ ] Navigate to Projects list - project card shows updated name

### 4. Editing Description

- [ ] Open edit dialog
- [ ] Change description to "Updated project description"
- [ ] Click "Save"
- [ ] Success message appears
- [ ] Close dialog
- [ ] Project Details section shows updated description

### 5. Removing Description

- [ ] Open edit dialog with project that has a description
- [ ] Clear description field completely
- [ ] Click "Save"
- [ ] Success message appears
- [ ] Close dialog
- [ ] Project Details section no longer shows description label/text

### 6. No Changes Scenario

- [ ] Open edit dialog
- [ ] Don't make any changes
- [ ] "Save" button is disabled (no changes detected)
- [ ] Make a change then revert it
- [ ] "Save" button is disabled again

### 7. API Failure Test

- [ ] Disconnect network or use invalid project ID
- [ ] Open edit dialog and make changes
- [ ] Click "Save"
- [ ] Error message appears with sanitized error text
- [ ] Dialog remains open
- [ ] Can retry by making changes and clicking "Save" again

### 8. Whitespace Trimming

- [ ] Enter " Project Name " (with leading/trailing spaces)
- [ ] Enter " Description " (with leading/trailing spaces)
- [ ] Save
- [ ] Verify API receives trimmed values
- [ ] Verify display shows trimmed values

### 9. Concurrent Mutation Prevention

- [ ] Open edit dialog
- [ ] Make changes
- [ ] Click "Save"
- [ ] While loading, "Save" button is disabled
- [ ] While loading, "Cancel" button is disabled
- [ ] Cannot close dialog during save
- [ ] Fields are disabled during save

### 10. Mobile Responsiveness

- [ ] Test on mobile viewport (375px width)
- [ ] Dialog fits within viewport
- [ ] No horizontal overflow
- [ ] All buttons are reachable and tappable
- [ ] Form fields are properly sized
- [ ] Text is readable

### 11. Data Persistence

- [ ] Edit project name
- [ ] Save successfully
- [ ] Refresh browser
- [ ] Navigate back to project detail
- [ ] Verify updated name is shown
- [ ] Verify project ID unchanged
- [ ] Verify all repositories still connected
- [ ] Verify threads still associated with project

### 12. Maximum Length Validation

- [ ] Enter 200 characters in name field - all accepted
- [ ] Try to enter 201st character - prevented (maxLength)
- [ ] Enter 1000 characters in description - all accepted
- [ ] Try to enter 1001st character - prevented (maxLength)

### 13. Keyboard Navigation

- [ ] Open dialog using Enter/Space on "Edit project" button
- [ ] Tab through form fields in order
- [ ] Make changes
- [ ] Press Enter in name field - form submits
- [ ] Press Enter in description field - form submits
- [ ] Press Escape - dialog closes

### 14. Query Cache Update

- [ ] Edit project name
- [ ] Save successfully
- [ ] Verify Projects list is updated (check queryClient invalidation)
- [ ] Verify Project Detail page is updated (check queryClient setQueryData)
- [ ] No unnecessary network requests

## Success Criteria

All test cases pass without errors or unexpected behavior.
