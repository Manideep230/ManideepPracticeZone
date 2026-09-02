import { MongoClient, Db } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'manideep_practice_db';

export const seedData = {
  students: [
    {
      _id: 1,
      name: "Rahul",
      age: 20,
      branch: "CSE",
      marks: 85,
      skills: ["Java", "MongoDB"],
      address: { city: "Hyderabad", state: "Telangana" },
      year: 2,
      email: "rahul@college.edu"
    },
    {
      _id: 2,
      name: "Priya",
      age: 21,
      branch: "ECE",
      marks: 92,
      skills: ["Python", "SQL"],
      address: { city: "Vijayawada", state: "Andhra Pradesh" },
      year: 3,
      email: "priya@college.edu"
    },
    {
      _id: 3,
      name: "Arjun",
      age: 19,
      branch: "CSE",
      marks: 74,
      skills: ["JavaScript", "MongoDB"],
      address: { city: "Hyderabad", state: "Telangana" },
      year: 1,
      email: "arjun@college.edu"
    },
    {
      _id: 4,
      name: "Sneha",
      age: 22,
      branch: "EEE",
      marks: 88,
      skills: ["C", "MATLAB"],
      address: { city: "Guntur", state: "Andhra Pradesh" },
      year: 4,
      email: "sneha@college.edu"
    },
    {
      _id: 5,
      name: "Kiran",
      age: 20,
      branch: "CSE",
      marks: 95,
      skills: ["Python", "MongoDB", "Docker"],
      address: { city: "Warangal", state: "Telangana" },
      year: 2,
      email: "kiran@college.edu"
    },
    {
      _id: 6,
      name: "Meera",
      age: 21,
      branch: "ECE",
      marks: 78,
      skills: ["VHDL", "Python"],
      address: { city: "Tirupati", state: "Andhra Pradesh" },
      year: 3,
      email: "meera@college.edu"
    },
    {
      _id: 7,
      name: "Vikram",
      age: 20,
      branch: "MECH",
      marks: 82,
      skills: ["AutoCAD", "SolidWorks"],
      address: { city: "Karimnagar", state: "Telangana" },
      year: 2,
      email: "vikram@college.edu"
    },
    {
      _id: 8,
      name: "Deepa",
      age: 22,
      branch: "CSE",
      marks: 91,
      skills: ["Java", "Spring", "MongoDB"],
      address: { city: "Nellore", state: "Andhra Pradesh" },
      year: 4,
      email: "deepa@college.edu"
    }
  ],

  courses: [
    { _id: 1, code: "CS101", name: "Data Structures", department: "CSE", credits: 4, semester: 3 },
    { _id: 2, code: "CS201", name: "Database Systems", department: "CSE", credits: 3, semester: 4 },
    { _id: 3, code: "EC101", name: "Digital Electronics", department: "ECE", credits: 4, semester: 3 },
    { _id: 4, code: "EE101", name: "Circuit Theory", department: "EEE", credits: 3, semester: 2 },
    { _id: 5, code: "ME101", name: "Thermodynamics", department: "MECH", credits: 4, semester: 3 },
    { _id: 6, code: "CS301", name: "Machine Learning", department: "CSE", credits: 3, semester: 6 },
    { _id: 7, code: "CS102", name: "Operating Systems", department: "CSE", credits: 4, semester: 4 }
  ],

  teachers: [
    { _id: 1, name: "Dr. Suresh Kumar", department: "CSE", subject: "Data Structures", experience: 12, email: "suresh@college.edu" },
    { _id: 2, name: "Dr. Lakshmi Devi", department: "ECE", subject: "Digital Electronics", experience: 15, email: "lakshmi@college.edu" },
    { _id: 3, name: "Prof. Ramesh Babu", department: "EEE", subject: "Circuit Theory", experience: 8, email: "ramesh@college.edu" },
    { _id: 4, name: "Dr. Anitha Rao", department: "CSE", subject: "Database Systems", experience: 10, email: "anitha@college.edu" },
    { _id: 5, name: "Prof. Venkat Reddy", department: "MECH", subject: "Thermodynamics", experience: 20, email: "venkat@college.edu" }
  ],

  departments: [
    { _id: 1, name: "CSE", fullName: "Computer Science and Engineering", hod: "Dr. Suresh Kumar", totalStudents: 120, established: 1995 },
    { _id: 2, name: "ECE", fullName: "Electronics and Communication Engineering", hod: "Dr. Lakshmi Devi", totalStudents: 90, established: 1998 },
    { _id: 3, name: "EEE", fullName: "Electrical and Electronics Engineering", hod: "Prof. Ramesh Babu", totalStudents: 75, established: 2000 },
    { _id: 4, name: "MECH", fullName: "Mechanical Engineering", hod: "Prof. Venkat Reddy", totalStudents: 80, established: 1995 }
  ],

  marks: [
    { _id: 1, studentId: 1, courseId: 1, score: 85, grade: "A", semester: 3 },
    { _id: 2, studentId: 1, courseId: 2, score: 88, grade: "A", semester: 4 },
    { _id: 3, studentId: 2, courseId: 3, score: 92, grade: "A+", semester: 3 },
    { _id: 4, studentId: 3, courseId: 1, score: 74, grade: "B", semester: 3 },
    { _id: 5, studentId: 3, courseId: 2, score: 70, grade: "B", semester: 4 },
    { _id: 6, studentId: 4, courseId: 4, score: 88, grade: "A", semester: 2 },
    { _id: 7, studentId: 5, courseId: 1, score: 95, grade: "A+", semester: 3 },
    { _id: 8, studentId: 5, courseId: 2, score: 93, grade: "A+", semester: 4 },
    { _id: 9, studentId: 6, courseId: 3, score: 78, grade: "B+", semester: 3 },
    { _id: 10, studentId: 7, courseId: 5, score: 82, grade: "A", semester: 3 },
    { _id: 11, studentId: 8, courseId: 1, score: 91, grade: "A+", semester: 3 },
    { _id: 12, studentId: 8, courseId: 6, score: 89, grade: "A", semester: 6 }
  ]
};

export async function seedDatabase(db: Db): Promise<void> {
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  for (const [collName, docs] of Object.entries(seedData)) {
    if (collectionNames.includes(collName)) {
      await db.collection(collName).drop();
    }
    await db.collection(collName).insertMany(docs as any[]);
    console.log(`  ✓ Seeded ${collName} with ${docs.length} documents`);
  }
}

// Run directly
if (process.argv[1] && process.argv[1].includes('seed')) {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db(DB_NAME);
    console.log(`Seeding database "${DB_NAME}"...`);
    await seedDatabase(db);
    console.log('\n✓ Database seeded successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}
