PROJECT: Interactive Kanban Task Board Web Application

OBJECTIVE:
Design and build a modern, fully functional Kanban-style task board web application that allows users to create, edit, organize, and track tasks across multiple columns.

CORE REQUIREMENTS:

Functional Requirements:
1. The application must support at minimum the following task columns:
   - Backlog
   - In Progress
   - Blocked
   - Done

2. Users must be able to:
   - Create tasks
   - Edit tasks
   - Delete tasks
   - Move tasks between columns
   - Assign priority levels
   - Add descriptions
   - Add due dates
   - Mark tasks complete

3. The board must support drag-and-drop if feasible. If drag-and-drop is not implemented, a clear alternative move mechanism must be provided.

4. The application must persist task data. You may use:
   - browser local storage
   - a lightweight database
   - an API-backed persistence layer

5. The UI must be responsive and usable on desktop and mobile screen sizes.

6. The application must include filtering or sorting by at least one of the following:
   - priority
   - due date
   - status

Technical Requirements:
1. Choose an appropriate stack and justify your selection.
2. Organize the project using maintainable structure and separation of concerns.
3. Include defensive handling for invalid input.
4. Include a README with setup and usage instructions.
5. The application must run locally with clear startup steps.

PLANNING REQUIREMENTS:
Before implementation, produce:
1. A short architecture plan
2. Chosen tech stack and rationale
3. File/folder structure proposal
4. Data model design
5. Validation and testing plan

CODING REQUIREMENTS:
1. Implement the project in full.
2. Use modular, readable code.
3. Include comments only where useful.
4. Do not leave major functionality stubbed or unimplemented.
5. Build the application so it is actually usable, not merely a visual prototype.

VALIDATION CRITERIA:
You must validate the implementation by proving:
1. Tasks can be created successfully
2. Tasks can be edited
3. Tasks can be deleted
4. Tasks can be moved between columns
5. Persisted data survives refresh or restart, depending on architecture
6. The UI remains usable and logically consistent

Validation evidence must include:
- clear execution steps
- test cases or manual verification checklist
- expected result vs actual result
- any screenshots/logs/output if available

FIXING / REMEDIATION REQUIREMENTS:
If validation reveals issues:
1. Identify the root cause
2. Fix the issue
3. Re-run validation
4. Record what changed
5. Do not claim completion until revalidation passes

DELIVERABLES:
1. Architecture summary
2. Full source code
3. Any configuration files
4. README
5. Validation report
6. Issue/fix summary if remediation was needed

COMPLETION CRITERIA:
The project is complete only when:
1. The application runs successfully
2. All core functional requirements work
3. Validation has been performed and documented
4. Any discovered issues have been addressed and revalidated
5. Deliverables are complete and organized
