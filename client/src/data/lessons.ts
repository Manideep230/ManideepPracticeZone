import { Lesson } from '../types';

export const lessons: Lesson[] = [
  {
    id: 1,
    title: "Introduction",
    concept: `MongoDB is a popular NoSQL database that stores data in flexible, JSON-like documents. Unlike traditional relational databases that use tables and rows, MongoDB uses collections and documents.

Key advantages of MongoDB:
• **Flexible Schema** — Documents in a collection can have different fields
• **Scalability** — Designed for horizontal scaling across many servers
• **Performance** — Optimized for read and write operations
• **Developer Friendly** — Works naturally with JSON, making it perfect for modern web applications

In MongoDB, data is organized as:
• **Database** → Contains collections (like a schema in SQL)
• **Collection** → Contains documents (like a table in SQL)
• **Document** → A single record stored in BSON format (like a row in SQL)`,
    syntax: `// Connect to a database
use college

// Show all databases
show dbs

// Show collections in current database
show collections`,
    example: `db.students.find()`,
    expectedOutput: `[
  { "_id": 1, "name": "Rahul", "age": 20, "branch": "CSE", "marks": 85 },
  { "_id": 2, "name": "Priya", "age": 21, "branch": "ECE", "marks": 92 },
  { "_id": 3, "name": "Arjun", "age": 19, "branch": "CSE", "marks": 74 },
  ...
]`,
    exercise: "Retrieve all documents from the students collection to see the data we'll be working with throughout this course.",
    hint: "Use the find() method on the students collection with no filter to get all documents.",
    solution: `db.students.find()`,
    validationQuery: `db.students.find()`,
    defaultEditorContent: `// Welcome to Manideep Practice Zone!\n// Let's start by viewing all students in our database.\n\ndb.students.find()`
  },
  {
    id: 2,
    title: "MongoDB Basics",
    concept: `MongoDB stores data in **BSON** (Binary JSON) format. BSON extends JSON with additional data types like Date, ObjectId, and more.

Every document in MongoDB must have a unique **_id** field. If you don't provide one, MongoDB automatically generates an ObjectId.

**Common Data Types in MongoDB:**
• **String** — Text values like "Rahul"
• **Number** — Integer or floating point like 85 or 3.14
• **Boolean** — true or false
• **Array** — Lists of values like ["Java", "Python"]
• **Object** — Nested documents like { city: "Hyderabad" }
• **ObjectId** — Auto-generated unique identifier
• **Date** — Date and time values
• **Null** — Represents empty or missing values

The MongoDB shell uses JavaScript syntax, so all commands are valid JavaScript expressions.`,
    syntax: `// Count documents in a collection
db.collection.countDocuments()

// Get distinct values of a field
db.collection.distinct("fieldName")`,
    example: `db.students.countDocuments()`,
    expectedOutput: `8`,
    exercise: "Count the total number of documents in the students collection.",
    hint: "Use the countDocuments() method on the students collection.",
    solution: `db.students.countDocuments()`,
    validationQuery: `db.students.countDocuments()`,
    defaultEditorContent: `// Count the total number of students\ndb.students.countDocuments()`
  },
  {
    id: 3,
    title: "Databases & Collections",
    concept: `In MongoDB, **databases** hold collections, and **collections** hold documents.

**Database Operations:**
• A database is created automatically when you first store data in it
• You can switch between databases using \`use <dbName>\`
• Our practice database is called "college"

**Collection Operations:**
• Collections are like tables in SQL
• A collection is created when you first insert a document into it
• Collection names are case-sensitive
• Our college database has: students, courses, teachers, departments, marks

**Naming Rules:**
• Database names cannot contain: /\\. "$*<>:|?
• Collection names cannot start with "system."
• Maximum length: 64 characters for collection names`,
    syntax: `// List all collections
show collections

// Access a collection
db.collectionName

// Count documents
db.collectionName.countDocuments()`,
    example: `db.courses.find()`,
    expectedOutput: `[
  { "_id": 1, "code": "CS101", "name": "Data Structures", "department": "CSE", "credits": 4 },
  { "_id": 2, "code": "CS201", "name": "Database Systems", "department": "CSE", "credits": 3 },
  ...
]`,
    exercise: "View all documents in the courses collection to see what courses are available.",
    hint: "Use the find() method on the courses collection.",
    solution: `db.courses.find()`,
    validationQuery: `db.courses.find()`,
    defaultEditorContent: `// View all courses in our college database\ndb.courses.find()`
  },
  {
    id: 4,
    title: "Documents & BSON",
    concept: `A **document** is the basic unit of data in MongoDB. Documents are analogous to rows in relational databases but are much more flexible.

**Document Structure:**
• Documents are stored as BSON (Binary JSON)
• Each document is a set of key-value pairs
• Keys are strings, values can be any BSON type
• Documents can contain nested documents and arrays
• Maximum document size is 16MB

**Example Document:**
\`\`\`json
{
  "_id": 1,
  "name": "Rahul",
  "age": 20,
  "branch": "CSE",
  "skills": ["Java", "MongoDB"],
  "address": {
    "city": "Hyderabad",
    "state": "Telangana"
  }
}
\`\`\`

Notice how the "skills" field is an **array** and "address" is a **nested document** (embedded document). This flexibility is one of MongoDB's greatest strengths.`,
    syntax: `// Find a single document
db.collection.findOne(filter)

// Find with specific fields
db.collection.findOne(filter, { field1: 1, field2: 1 })`,
    example: `db.students.findOne({ name: "Rahul" })`,
    expectedOutput: `{
  "_id": 1,
  "name": "Rahul",
  "age": 20,
  "branch": "CSE",
  "marks": 85,
  "skills": ["Java", "MongoDB"],
  "address": { "city": "Hyderabad", "state": "Telangana" }
}`,
    exercise: "Find the document for the student named 'Kiran' to see all their details including nested fields.",
    hint: "Use findOne() with a filter on the name field.",
    solution: `db.students.findOne({ name: "Kiran" })`,
    validationQuery: `db.students.findOne({ name: "Kiran" })`,
    defaultEditorContent: `// Find a single student by name\ndb.students.findOne({ name: "Rahul" })`
  },
  {
    id: 5,
    title: "Insert Operations",
    concept: `MongoDB provides two methods for inserting documents:

**insertOne()** — Inserts a single document
• Returns the inserted document's _id
• If no _id is provided, MongoDB generates one automatically
• The insertion fails if a document with the same _id already exists

**insertMany()** — Inserts multiple documents at once
• Accepts an array of documents
• Returns all inserted _ids
• More efficient than multiple insertOne() calls
• By default, insertion stops on first error (ordered: true)

**Important Notes:**
• New fields can be added without modifying existing documents
• Each document can have a different structure
• Data types are preserved as specified`,
    syntax: `// Insert a single document
db.collection.insertOne({ field1: value1, field2: value2 })

// Insert multiple documents
db.collection.insertMany([
  { field1: value1 },
  { field1: value2 }
])`,
    example: `db.students.insertOne({
  _id: 100,
  name: "Akhil",
  age: 20,
  branch: "CSE",
  marks: 78,
  skills: ["React", "Node.js"],
  address: { city: "Chennai", state: "Tamil Nadu" }
})`,
    expectedOutput: `{
  "acknowledged": true,
  "insertedId": 100
}`,
    exercise: "Insert a new student with _id: 101, name: 'Divya', age: 21, branch: 'ECE', marks: 86, skills: ['Python', 'C++'], and address: { city: 'Bangalore', state: 'Karnataka' }.",
    hint: "Use insertOne() with all the fields specified in the exercise. Make sure to include the _id field.",
    solution: `db.students.insertOne({ _id: 101, name: "Divya", age: 21, branch: "ECE", marks: 86, skills: ["Python", "C++"], address: { city: "Bangalore", state: "Karnataka" } })`,
    validationQuery: `db.students.findOne({ _id: 101 })`,
    defaultEditorContent: `// Insert a new student document\ndb.students.insertOne({\n  _id: 100,\n  name: "Akhil",\n  age: 20,\n  branch: "CSE",\n  marks: 78,\n  skills: ["React", "Node.js"],\n  address: { city: "Chennai", state: "Tamil Nadu" }\n})`
  },
  {
    id: 6,
    title: "Find Operations",
    concept: `The **find()** method is the primary way to query documents in MongoDB. It accepts a filter object and returns all matching documents.

**Basic Queries:**
• **Empty filter \`{}\`** — Returns all documents
• **Equality** — \`{ field: value }\` matches exact values
• **Multiple conditions** — \`{ field1: v1, field2: v2 }\` acts as AND

**find() vs findOne():**
• \`find()\` returns a cursor (array of documents)
• \`findOne()\` returns a single document (or null)

**Query by different data types:**
• String: \`{ name: "Rahul" }\`
• Number: \`{ marks: 85 }\`
• Boolean: \`{ active: true }\`
• Nested field: \`{ "address.city": "Hyderabad" }\` (dot notation)`,
    syntax: `// Find all documents
db.collection.find()

// Find with filter
db.collection.find({ field: value })

// Find with multiple conditions (AND)
db.collection.find({ field1: value1, field2: value2 })

// Find by nested field (dot notation)
db.collection.find({ "parent.child": value })`,
    example: `db.students.find({ branch: "CSE" })`,
    expectedOutput: `[
  { "_id": 1, "name": "Rahul", "branch": "CSE", "marks": 85, ... },
  { "_id": 3, "name": "Arjun", "branch": "CSE", "marks": 74, ... },
  { "_id": 5, "name": "Kiran", "branch": "CSE", "marks": 95, ... },
  { "_id": 8, "name": "Deepa", "branch": "CSE", "marks": 91, ... }
]`,
    exercise: "Find all students who live in Hyderabad. Use dot notation to query the nested address.city field.",
    hint: 'Use dot notation to access nested fields: { "address.city": "Hyderabad" }',
    solution: `db.students.find({ "address.city": "Hyderabad" })`,
    validationQuery: `db.students.find({ "address.city": "Hyderabad" })`,
    defaultEditorContent: `// Find all CSE students\ndb.students.find({ branch: "CSE" })`
  },
  {
    id: 7,
    title: "Query Operators",
    concept: `MongoDB provides powerful **comparison** and **logical** operators for complex queries.

**Comparison Operators:**
• **$gt** — Greater than
• **$gte** — Greater than or equal to
• **$lt** — Less than
• **$lte** — Less than or equal to
• **$eq** — Equal to
• **$ne** — Not equal to
• **$in** — Matches any value in an array
• **$nin** — Does not match any value in an array

**Logical Operators:**
• **$and** — All conditions must be true
• **$or** — At least one condition must be true
• **$not** — Negates a condition
• **$nor** — None of the conditions should be true

Operators are written as nested objects: \`{ field: { $operator: value } }\``,
    syntax: `// Comparison
db.collection.find({ field: { $gt: value } })

// Logical OR
db.collection.find({ $or: [{ condition1 }, { condition2 }] })

// Combining operators
db.collection.find({ field: { $gte: min, $lte: max } })`,
    example: `db.students.find({ marks: { $gt: 80 } })`,
    expectedOutput: `[
  { "_id": 1, "name": "Rahul", "marks": 85, ... },
  { "_id": 2, "name": "Priya", "marks": 92, ... },
  { "_id": 4, "name": "Sneha", "marks": 88, ... },
  { "_id": 5, "name": "Kiran", "marks": 95, ... },
  { "_id": 7, "name": "Vikram", "marks": 82, ... },
  { "_id": 8, "name": "Deepa", "marks": 91, ... }
]`,
    exercise: "Find all students whose marks are between 80 and 90 (inclusive). Use $gte and $lte operators.",
    hint: "Combine $gte and $lte in the same field: { marks: { $gte: 80, $lte: 90 } }",
    solution: `db.students.find({ marks: { $gte: 80, $lte: 90 } })`,
    validationQuery: `db.students.find({ marks: { $gte: 80, $lte: 90 } })`,
    defaultEditorContent: `// Find students with marks greater than 80\ndb.students.find({ marks: { $gt: 80 } })`
  },
  {
    id: 8,
    title: "Projection",
    concept: `**Projection** controls which fields appear in query results. By default, all fields are returned. You can include or exclude specific fields.

**Projection Rules:**
• **Include fields** — Set to 1: \`{ name: 1, marks: 1 }\`
• **Exclude fields** — Set to 0: \`{ skills: 0, address: 0 }\`
• **Cannot mix** include and exclude (except _id)
• **_id** is always included unless explicitly excluded with \`{ _id: 0 }\`

**Why use Projection?**
• Reduces network bandwidth
• Improves query performance
• Returns only the data you need
• Makes output cleaner and more readable`,
    syntax: `// Include specific fields
db.collection.find(filter, { field1: 1, field2: 1 })

// Exclude specific fields
db.collection.find(filter, { field1: 0, field2: 0 })

// Exclude _id, include others
db.collection.find(filter, { _id: 0, name: 1, marks: 1 })`,
    example: `db.students.find({}, { _id: 0, name: 1, branch: 1, marks: 1 })`,
    expectedOutput: `[
  { "name": "Rahul", "branch": "CSE", "marks": 85 },
  { "name": "Priya", "branch": "ECE", "marks": 92 },
  { "name": "Arjun", "branch": "CSE", "marks": 74 },
  ...
]`,
    exercise: "Find all CSE students but only return their name and marks (exclude _id).",
    hint: "Use projection as the second argument: find({ branch: 'CSE' }, { _id: 0, name: 1, marks: 1 })",
    solution: `db.students.find({ branch: "CSE" }, { _id: 0, name: 1, marks: 1 })`,
    validationQuery: `db.students.find({ branch: "CSE" }, { _id: 0, name: 1, marks: 1 })`,
    defaultEditorContent: `// Get only name, branch, and marks (no _id)\ndb.students.find({}, { _id: 0, name: 1, branch: 1, marks: 1 })`
  },
  {
    id: 9,
    title: "Update Operations",
    concept: `MongoDB provides several methods to update documents:

**updateOne()** — Updates the first document matching the filter
**updateMany()** — Updates all documents matching the filter
**replaceOne()** — Replaces the entire document (except _id)

**Update Operators:**
• **$set** — Sets a field's value (creates if doesn't exist)
• **$unset** — Removes a field from the document
• **$inc** — Increments a field by a specified amount
• **$push** — Adds an element to an array
• **$pull** — Removes elements from an array
• **$addToSet** — Adds to array only if not already present
• **$rename** — Renames a field
• **$min / $max** — Updates only if new value is less/greater

**Important:** Always use update operators. Passing a plain object (without $set, etc.) will cause an error.`,
    syntax: `// Update one document
db.collection.updateOne(filter, { $set: { field: newValue } })

// Update multiple documents
db.collection.updateMany(filter, { $set: { field: newValue } })

// Increment a value
db.collection.updateOne(filter, { $inc: { field: amount } })

// Push to an array
db.collection.updateOne(filter, { $push: { arrayField: newElement } })`,
    example: `db.students.updateOne(
  { name: "Rahul" },
  { $set: { marks: 90 } }
)`,
    expectedOutput: `{
  "acknowledged": true,
  "matchedCount": 1,
  "modifiedCount": 1
}`,
    exercise: "Add the skill 'Docker' to Arjun's skills array using the $push operator.",
    hint: "Use updateOne with $push: { skills: 'Docker' } and filter by name: 'Arjun'",
    solution: `db.students.updateOne({ name: "Arjun" }, { $push: { skills: "Docker" } })`,
    validationQuery: `db.students.findOne({ name: "Arjun" })`,
    defaultEditorContent: `// Update Rahul's marks to 90\ndb.students.updateOne(\n  { name: "Rahul" },\n  { $set: { marks: 90 } }\n)`
  },
  {
    id: 10,
    title: "Delete Operations",
    concept: `MongoDB provides two methods for deleting documents:

**deleteOne()** — Deletes the first document matching the filter
• Returns the count of deleted documents
• If multiple documents match, only the first one is deleted

**deleteMany()** — Deletes all documents matching the filter
• Returns the count of deleted documents
• Use \`{}\` as filter to delete all documents (be careful!)

**Important Considerations:**
• Delete operations are permanent — there's no "undo"
• Always test your filter with find() before using delete
• Use the Reset Database button to restore original data after practicing deletes
• Empty filter \`{}\` in deleteMany will delete ALL documents`,
    syntax: `// Delete one document
db.collection.deleteOne({ field: value })

// Delete multiple documents
db.collection.deleteMany({ field: value })

// Delete all documents (careful!)
db.collection.deleteMany({})`,
    example: `db.students.deleteOne({ name: "Rahul" })`,
    expectedOutput: `{
  "acknowledged": true,
  "deletedCount": 1
}`,
    exercise: "Delete all students from the EEE branch using deleteMany().",
    hint: "Use deleteMany with a filter on branch: 'EEE'",
    solution: `db.students.deleteMany({ branch: "EEE" })`,
    validationQuery: `db.students.deleteMany({ branch: "EEE" })`,
    defaultEditorContent: `// Delete a student by name\ndb.students.deleteOne({ name: "Rahul" })\n\n// Tip: Use the Reset Database button to restore data!`
  },
  {
    id: 11,
    title: "Sorting & Limiting",
    concept: `MongoDB provides cursor methods to control the order and number of returned documents.

**sort()** — Orders documents by specified fields
• \`1\` for ascending order
• \`-1\` for descending order
• Can sort by multiple fields

**limit()** — Restricts the number of returned documents
• Useful for pagination and "top N" queries

**skip()** — Skips a specified number of documents
• Used with limit() for pagination
• skip(10).limit(5) = page 3 with 5 items per page

**Method Chaining:**
These methods can be chained: \`find().sort().limit().skip()\`
The order of chaining doesn't matter — MongoDB optimizes the execution.`,
    syntax: `// Sort ascending by field
db.collection.find().sort({ field: 1 })

// Sort descending
db.collection.find().sort({ field: -1 })

// Limit results
db.collection.find().limit(n)

// Combine sort and limit
db.collection.find().sort({ field: -1 }).limit(3)`,
    example: `db.students.find({}, { _id: 0, name: 1, marks: 1 }).sort({ marks: -1 }).limit(3)`,
    expectedOutput: `[
  { "name": "Kiran", "marks": 95 },
  { "name": "Priya", "marks": 92 },
  { "name": "Deepa", "marks": 91 }
]`,
    exercise: "Find the 3 youngest students (sort by age ascending, limit to 3). Show only their name and age (exclude _id).",
    hint: "Chain sort({ age: 1 }) and limit(3) on the find query with projection { _id: 0, name: 1, age: 1 }",
    solution: `db.students.find({}, { _id: 0, name: 1, age: 1 }).sort({ age: 1 }).limit(3)`,
    validationQuery: `db.students.find({}, { _id: 0, name: 1, age: 1 }).sort({ age: 1 }).limit(3)`,
    defaultEditorContent: `// Top 3 students by marks (descending)\ndb.students.find({}, { _id: 0, name: 1, marks: 1 }).sort({ marks: -1 }).limit(3)`
  },
  {
    id: 12,
    title: "Arrays",
    concept: `MongoDB has powerful operators for working with **arrays** in documents.

**Array Query Operators:**
• **Exact match** — \`{ skills: ["Java", "MongoDB"] }\` matches the exact array
• **Contains element** — \`{ skills: "MongoDB" }\` matches if array contains the value
• **$all** — Array contains ALL specified elements
• **$size** — Array has exactly N elements
• **$elemMatch** — At least one element matches all conditions

**Array Update Operators:**
• **$push** — Add an element to the array
• **$pull** — Remove matching elements
• **$addToSet** — Add only if not already present
• **$pop** — Remove first (-1) or last (1) element
• **\`$each\`** — Used with $push/$addToSet for multiple elements

Arrays are one of MongoDB's most powerful features, allowing you to model one-to-many relationships within a single document.`,
    syntax: `// Find docs where array contains a value
db.collection.find({ arrayField: "value" })

// Find docs where array contains ALL values
db.collection.find({ arrayField: { $all: ["val1", "val2"] } })

// Find docs where array has specific size
db.collection.find({ arrayField: { $size: 3 } })`,
    example: `db.students.find({ skills: "MongoDB" })`,
    expectedOutput: `[
  { "_id": 1, "name": "Rahul", "skills": ["Java", "MongoDB"], ... },
  { "_id": 3, "name": "Arjun", "skills": ["JavaScript", "MongoDB"], ... },
  { "_id": 5, "name": "Kiran", "skills": ["Python", "MongoDB", "Docker"], ... },
  { "_id": 8, "name": "Deepa", "skills": ["Java", "Spring", "MongoDB"], ... }
]`,
    exercise: "Find all students who have exactly 3 skills using the $size operator.",
    hint: "Use $size to match array length: { skills: { $size: 3 } }",
    solution: `db.students.find({ skills: { $size: 3 } })`,
    validationQuery: `db.students.find({ skills: { $size: 3 } })`,
    defaultEditorContent: `// Find students who know MongoDB\ndb.students.find({ skills: "MongoDB" })`
  },
  {
    id: 13,
    title: "Embedded Documents",
    concept: `MongoDB allows **nested documents** (embedded documents) within other documents. This is a powerful way to model related data together.

**Querying Embedded Documents:**
• Use **dot notation** to access nested fields: \`"address.city"\`
• You can query nested fields at any depth
• Dot notation works in filters, projections, updates, and aggregations

**Exact Match vs Dot Notation:**
• \`{ address: { city: "Hyderabad", state: "Telangana" } }\` — Exact match (order matters!)
• \`{ "address.city": "Hyderabad" }\` — Matches any document where address.city equals "Hyderabad"

**When to Embed Documents:**
• Data is always accessed together
• One-to-few relationships
• Data doesn't need to be queried independently
• Example: address inside a student document`,
    syntax: `// Query nested field with dot notation
db.collection.find({ "parent.child": value })

// Update nested field
db.collection.updateOne(
  { _id: 1 },
  { $set: { "parent.child": newValue } }
)

// Project nested fields
db.collection.find({}, { "parent.child": 1 })`,
    example: `db.students.find({ "address.state": "Telangana" })`,
    expectedOutput: `[
  { "_id": 1, "name": "Rahul", "address": { "city": "Hyderabad", "state": "Telangana" }, ... },
  { "_id": 3, "name": "Arjun", "address": { "city": "Hyderabad", "state": "Telangana" }, ... },
  { "_id": 5, "name": "Kiran", "address": { "city": "Warangal", "state": "Telangana" }, ... },
  { "_id": 7, "name": "Vikram", "address": { "city": "Karimnagar", "state": "Telangana" }, ... }
]`,
    exercise: "Find all students from Andhra Pradesh. Return only their name and city (exclude _id).",
    hint: 'Filter by "address.state": "Andhra Pradesh" and project _id: 0, name: 1, "address.city": 1',
    solution: `db.students.find({ "address.state": "Andhra Pradesh" }, { _id: 0, name: 1, "address.city": 1 })`,
    validationQuery: `db.students.find({ "address.state": "Andhra Pradesh" }, { _id: 0, name: 1, "address.city": 1 })`,
    defaultEditorContent: `// Find students from Telangana\ndb.students.find({ "address.state": "Telangana" })`
  },
  {
    id: 14,
    title: "Data Modeling",
    concept: `**Data modeling** in MongoDB is about choosing how to structure your documents. The two main approaches are **embedding** and **referencing**.

**Embedding (Denormalization):**
• Store related data in the same document
• Best for: one-to-few, data always queried together
• Pros: Single query, atomic updates, better read performance
• Cons: Document size limit (16MB), data duplication

**Referencing (Normalization):**
• Store related data in separate collections with references (_id)
• Best for: one-to-many, many-to-many, data queried independently
• Pros: No duplication, no size limits, flexible
• Cons: Requires multiple queries or $lookup

**Our Database Example:**
• **Embedded**: student.address (always accessed with student)
• **Referenced**: marks.studentId references students._id

**Rule of Thumb:** Embed when you can, reference when you must.`,
    syntax: `// Embedded approach (one document)
{
  name: "Rahul",
  address: { city: "Hyderabad", state: "Telangana" }
}

// Referenced approach (separate collections)
// In students: { _id: 1, name: "Rahul" }
// In marks: { studentId: 1, courseId: 1, score: 85 }`,
    example: `db.marks.find({ studentId: 1 })`,
    expectedOutput: `[
  { "_id": 1, "studentId": 1, "courseId": 1, "score": 85, "grade": "A", "semester": 3 },
  { "_id": 2, "studentId": 1, "courseId": 2, "score": 88, "grade": "A", "semester": 4 }
]`,
    exercise: "Find all marks records for student with _id: 5 to see how referencing works.",
    hint: "Query the marks collection where studentId equals 5.",
    solution: `db.marks.find({ studentId: 5 })`,
    validationQuery: `db.marks.find({ studentId: 5 })`,
    defaultEditorContent: `// Find marks for student with _id 1 (referenced data)\ndb.marks.find({ studentId: 1 })`
  },
  {
    id: 15,
    title: "Aggregation",
    concept: `The **aggregation pipeline** is MongoDB's most powerful feature for data analysis. It processes documents through a series of stages, where each stage transforms the data.

**Common Stages:**
• **$match** — Filter documents (like find)
• **$group** — Group by field and compute aggregates
• **$project** — Reshape documents (include/exclude/rename fields)
• **$sort** — Sort documents
• **$limit** — Limit number of results
• **$unwind** — Deconstruct an array field
• **$count** — Count documents

**Group Accumulator Operators:**
• **$sum** — Sum of values (or count with $sum: 1)
• **$avg** — Average of values
• **$min / $max** — Minimum / Maximum value
• **$push** — Collect values into an array
• **$first / $last** — First / Last value

The pipeline is an array of stage objects, processed in order.`,
    syntax: `db.collection.aggregate([
  { $match: { condition } },
  { $group: {
    _id: "$groupField",
    total: { $sum: "$field" },
    average: { $avg: "$field" }
  }},
  { $sort: { total: -1 } }
])`,
    example: `db.students.aggregate([
  { $group: {
    _id: "$branch",
    avgMarks: { $avg: "$marks" },
    count: { $sum: 1 }
  }}
])`,
    expectedOutput: `[
  { "_id": "CSE", "avgMarks": 86.25, "count": 4 },
  { "_id": "ECE", "avgMarks": 85, "count": 2 },
  { "_id": "EEE", "avgMarks": 88, "count": 1 },
  { "_id": "MECH", "avgMarks": 82, "count": 1 }
]`,
    exercise: "Calculate the average marks and count of students for each state using aggregation. Group by 'address.state'.",
    hint: 'Use $group with _id: "$address.state", avgMarks: { $avg: "$marks" }, count: { $sum: 1 }',
    solution: `db.students.aggregate([{ $group: { _id: "$address.state", avgMarks: { $avg: "$marks" }, count: { $sum: 1 } } }])`,
    validationQuery: `db.students.aggregate([{ $group: { _id: "$address.state", avgMarks: { $avg: "$marks" }, count: { $sum: 1 } } }])`,
    defaultEditorContent: `// Average marks per branch\ndb.students.aggregate([\n  { $group: {\n    _id: "$branch",\n    avgMarks: { $avg: "$marks" },\n    count: { $sum: 1 }\n  }}\n])`
  },
  {
    id: 16,
    title: "$lookup",
    concept: `**$lookup** performs a left outer join between two collections — similar to JOIN in SQL. It's used in the aggregation pipeline to combine data from different collections.

**$lookup Syntax:**
• **from** — The collection to join with
• **localField** — Field from the input documents
• **foreignField** — Field from the "from" collection
• **as** — Name for the new array field containing matches

**How it works:**
1. For each document in the pipeline, MongoDB finds matching documents in the "from" collection
2. Matching documents are added as an array in the "as" field
3. If no matches are found, the "as" field is an empty array

**Use Cases:**
• Joining students with their marks
• Joining courses with their departments
• Any cross-collection relationship`,
    syntax: `db.collection.aggregate([
  { $lookup: {
    from: "otherCollection",
    localField: "fieldInThisCollection",
    foreignField: "fieldInOtherCollection",
    as: "resultArrayName"
  }}
])`,
    example: `db.students.aggregate([
  { $match: { _id: 1 } },
  { $lookup: {
    from: "marks",
    localField: "_id",
    foreignField: "studentId",
    as: "studentMarks"
  }}
])`,
    expectedOutput: `[{
  "_id": 1,
  "name": "Rahul",
  "branch": "CSE",
  "studentMarks": [
    { "studentId": 1, "courseId": 1, "score": 85, "grade": "A" },
    { "studentId": 1, "courseId": 2, "score": 88, "grade": "A" }
  ]
}]`,
    exercise: "Use $lookup to join the courses collection with departments. Join on the 'department' field in courses and the 'name' field in departments. Name the result 'deptInfo'.",
    hint: "Use $lookup with from: 'departments', localField: 'department', foreignField: 'name', as: 'deptInfo'",
    solution: `db.courses.aggregate([{ $lookup: { from: "departments", localField: "department", foreignField: "name", as: "deptInfo" } }])`,
    validationQuery: `db.courses.aggregate([{ $lookup: { from: "departments", localField: "department", foreignField: "name", as: "deptInfo" } }])`,
    defaultEditorContent: `// Join students with their marks\ndb.students.aggregate([\n  { $match: { _id: 1 } },\n  { $lookup: {\n    from: "marks",\n    localField: "_id",\n    foreignField: "studentId",\n    as: "studentMarks"\n  }}\n])`
  },
  {
    id: 17,
    title: "Indexes",
    concept: `**Indexes** improve the speed of queries by allowing MongoDB to find documents without scanning every document in a collection.

**Without an index:** MongoDB performs a **collection scan** — checking every document. This is slow for large collections.

**With an index:** MongoDB uses the index to quickly locate matching documents, like an index in a book.

**Types of Indexes:**
• **Single Field** — Index on one field: \`{ name: 1 }\`
• **Compound** — Index on multiple fields: \`{ branch: 1, marks: -1 }\`
• **Multikey** — Automatically created for array fields
• **Text** — For text search: \`{ name: "text" }\`
• **Unique** — Ensures no duplicate values: \`{ email: 1 }, { unique: true }\`

**Trade-offs:**
• Indexes speed up reads but slow down writes
• Each index uses memory and disk space
• Too many indexes can hurt write performance
• The _id field is always indexed automatically`,
    syntax: `// Create an index
db.collection.createIndex({ field: 1 })  // 1=ascending, -1=descending

// Create compound index
db.collection.createIndex({ field1: 1, field2: -1 })

// Create unique index
db.collection.createIndex({ field: 1 }, { unique: true })

// View all indexes
db.collection.getIndexes()`,
    example: `db.students.createIndex({ branch: 1, marks: -1 })`,
    expectedOutput: `"branch_1_marks_-1"`,
    exercise: "Create a single-field index on the 'name' field of the students collection (ascending).",
    hint: "Use createIndex({ name: 1 }) on the students collection.",
    solution: `db.students.createIndex({ name: 1 })`,
    validationQuery: `db.students.getIndexes()`,
    defaultEditorContent: `// Create a compound index on branch and marks\ndb.students.createIndex({ branch: 1, marks: -1 })`
  },
  {
    id: 18,
    title: "Query Performance",
    concept: `Understanding query performance is crucial for building efficient MongoDB applications.

**Analyzing Queries:**
• Use indexes to avoid collection scans
• Check which indexes exist with \`getIndexes()\`
• Compound indexes can serve multiple queries
• Index order matters for compound indexes

**Query Optimization Tips:**
1. **Create indexes** for frequently queried fields
2. **Use projection** to return only needed fields
3. **Limit results** when you don't need all documents
4. **Use covered queries** where all fields are in the index
5. **Avoid $regex** without anchors (can't use index efficiently)
6. **Use $in** instead of multiple $or conditions

**Index Selection:**
• MongoDB chooses the best index automatically
• For compound indexes, the query must match a prefix
• Index { a: 1, b: 1 } works for queries on { a } or { a, b } but NOT just { b }

**Performance Metrics:**
• Documents examined vs returned
• Index keys examined
• Execution time`,
    syntax: `// Get indexes on a collection
db.collection.getIndexes()

// Count with filter (uses index if available)
db.collection.countDocuments({ field: value })

// Efficient pagination
db.collection.find(filter).sort({ _id: 1 }).limit(10).skip(20)`,
    example: `db.students.getIndexes()`,
    expectedOutput: `[
  { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
  { "v": 2, "key": { "branch": 1, "marks": -1 }, "name": "branch_1_marks_-1" }
]`,
    exercise: "View all indexes on the students collection using getIndexes().",
    hint: "Use db.students.getIndexes() to see all indexes.",
    solution: `db.students.getIndexes()`,
    validationQuery: `db.students.getIndexes()`,
    defaultEditorContent: `// View all indexes on students\ndb.students.getIndexes()`
  },
  {
    id: 19,
    title: "Schema Validation",
    concept: `While MongoDB is schema-flexible, you can enforce **schema validation** rules on collections to ensure data quality.

**Validation Levels:**
• **strict** — Validates all inserts and updates
• **moderate** — Only validates documents that already match the schema

**Validation Actions:**
• **error** — Reject documents that fail validation
• **warn** — Allow but log a warning

**JSON Schema:**
MongoDB uses JSON Schema format to define validation rules:
• **bsonType** — Required data type (string, int, object, array, etc.)
• **required** — List of required fields
• **properties** — Field-level validation rules
• **minimum / maximum** — Numeric range
• **minLength / maxLength** — String length
• **enum** — List of allowed values

In our practice environment, we can demonstrate validation concepts using queries that check data consistency.`,
    syntax: `// Create collection with validation
db.createCollection("collName", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "age"],
      properties: {
        name: { bsonType: "string" },
        age: { bsonType: "int", minimum: 0 }
      }
    }
  }
})`,
    example: `db.students.find({
  $or: [
    { name: { $exists: false } },
    { branch: { $exists: false } },
    { marks: { $exists: false } }
  ]
})`,
    expectedOutput: `[]  // Empty - all documents have required fields`,
    exercise: "Find all students where marks is not a number (i.e., marks doesn't exist). This checks data quality.",
    hint: "Use $exists: false to check if a field is missing: { marks: { $exists: false } }",
    solution: `db.students.find({ marks: { $exists: false } })`,
    validationQuery: `db.students.find({ marks: { $exists: false } })`,
    defaultEditorContent: `// Check for documents missing required fields\ndb.students.find({\n  $or: [\n    { name: { $exists: false } },\n    { branch: { $exists: false } },\n    { marks: { $exists: false } }\n  ]\n})`
  },
  {
    id: 20,
    title: "Transactions",
    concept: `**Transactions** allow you to execute multiple operations as a single atomic unit. Either all operations succeed, or all are rolled back.

**ACID Properties:**
• **Atomicity** — All or nothing
• **Consistency** — Data remains valid
• **Isolation** — Concurrent operations don't interfere
• **Durability** — Committed data persists

**When to use Transactions:**
• Transferring data between documents
• Updating related documents that must stay consistent
• Any operation where partial completion would corrupt data

**Important Notes:**
• Transactions are available since MongoDB 4.0 (replica sets) and 4.2 (sharded clusters)
• They add overhead — use only when necessary
• Keep transactions short for better performance
• Our practice environment focuses on single-collection operations

**Alternative to Transactions:**
For many use cases, embedding related data in a single document provides atomic updates without transactions.`,
    syntax: `// Transaction pattern (conceptual)
session.startTransaction()
try {
  db.accounts.updateOne(
    { _id: "A" },
    { $inc: { balance: -100 } },
    { session }
  )
  db.accounts.updateOne(
    { _id: "B" },
    { $inc: { balance: 100 } },
    { session }
  )
  session.commitTransaction()
} catch (error) {
  session.abortTransaction()
}`,
    example: `db.students.find({ branch: "CSE" }, { _id: 0, name: 1, marks: 1 })`,
    expectedOutput: `[
  { "name": "Rahul", "marks": 85 },
  { "name": "Arjun", "marks": 74 },
  { "name": "Kiran", "marks": 95 },
  { "name": "Deepa", "marks": 91 }
]`,
    exercise: "Practice a common transaction-like operation: Find all CSE students and display their names and marks to verify data consistency.",
    hint: "Use find with branch: 'CSE' and projection to show only name and marks.",
    solution: `db.students.find({ branch: "CSE" }, { _id: 0, name: 1, marks: 1 })`,
    validationQuery: `db.students.find({ branch: "CSE" }, { _id: 0, name: 1, marks: 1 })`,
    defaultEditorContent: `// Verify data consistency - view CSE student marks\ndb.students.find({ branch: "CSE" }, { _id: 0, name: 1, marks: 1 })`
  },
  {
    id: 21,
    title: "Final Project",
    concept: `Congratulations on completing all the MongoDB lessons! 🎉

This final project combines everything you've learned. You'll perform a series of operations on the college database to demonstrate your MongoDB skills.

**Project Tasks:**
1. Find the top 3 students by marks
2. Calculate average marks per branch
3. Find students with specific skills
4. Use $lookup to join collections
5. Create useful indexes
6. Perform insert, update, and delete operations

Try each task below, and check your work with the exercise validator. Remember, you can always reset the database to start fresh!

**Skills Covered:**
• CRUD Operations (Create, Read, Update, Delete)
• Query Operators ($gt, $lt, $in, $all, etc.)
• Projection and Sorting
• Aggregation Pipeline
• $lookup Joins
• Array Operations
• Embedded Document Queries
• Indexes`,
    syntax: `// No new syntax — this project uses everything you've learned!
// Combine find, aggregate, update, and more.`,
    example: `db.students.aggregate([
  { $match: { marks: { $gte: 80 } } },
  { $group: {
    _id: "$address.state",
    topStudents: { $push: "$name" },
    avgMarks: { $avg: "$marks" }
  }},
  { $sort: { avgMarks: -1 } }
])`,
    expectedOutput: `[
  { "_id": "Telangana", "topStudents": ["Rahul", "Kiran", "Vikram"], "avgMarks": 87.33 },
  { "_id": "Andhra Pradesh", "topStudents": ["Priya", "Sneha", "Deepa"], "avgMarks": 90.33 }
]`,
    exercise: "Write an aggregation that groups students by branch, calculates the average marks, finds the maximum marks, counts students, and sorts by average marks descending.",
    hint: "Use $group with _id: '$branch', $avg, $max, $sum: 1, then $sort by avgMarks: -1",
    solution: `db.students.aggregate([{ $group: { _id: "$branch", avgMarks: { $avg: "$marks" }, maxMarks: { $max: "$marks" }, count: { $sum: 1 } } }, { $sort: { avgMarks: -1 } }])`,
    validationQuery: `db.students.aggregate([{ $group: { _id: "$branch", avgMarks: { $avg: "$marks" }, maxMarks: { $max: "$marks" }, count: { $sum: 1 } } }, { $sort: { avgMarks: -1 } }])`,
    defaultEditorContent: `// Final Project: Comprehensive MongoDB Query\n// Group students by branch with statistics\n\ndb.students.aggregate([\n  { $group: {\n    _id: "$branch",\n    avgMarks: { $avg: "$marks" },\n    maxMarks: { $max: "$marks" },\n    count: { $sum: 1 }\n  }},\n  { $sort: { avgMarks: -1 } }\n])`
  }
];
