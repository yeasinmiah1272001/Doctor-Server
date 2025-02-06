const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qlvqjvw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // Collections
    const doctorsCollection = client.db("doctorsdb").collection("doctors");
    console.log("Connected to MongoDB successfully!");

    // GET all doctors
    app.get("/doctors", async (req, res) => {
      try {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch doctors", error });
      }
    });

    // POST a new doctor
    app.post("/doctors", async (req, res) => {
      try {
        const item = req.body;
        const result = await doctorsCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add doctor", error });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("Doctor appointment is running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
