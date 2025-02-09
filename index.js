const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const cartsCollection = client.db("doctorsdb").collection("carts");
    const userCollection = client.db("doctorsdb").collection("users");
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
    app.get("/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.findOne(query);
      res.send(result);
    });
    // add to cart api
    app.post("/doctors-carts", async (req, res) => {
      const doctorItem = req.body;
      const result = await cartsCollection.insertOne(doctorItem);
      res.send(result);
    });

    app.get("/doctors-carts/:email", async (req, res) => {
      const email = req.params.email;
      console.log("email", email);
      const query = { email: email };
      console.log("query", query);
      const result = await cartsCollection.find(query).toArray();
      console.log("result", result);
      res.send(result);
    });

    // user related api

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      // const user = req.body;
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
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
