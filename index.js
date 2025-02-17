const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 8000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
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
    const paymentCollection = client.db("doctorsdb").collection("payment");
    console.log("Connected to MongoDB successfully!");

    // token related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCES_TOKEN, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    const veryfyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send("sorry you are not authorized");
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCES_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(403).send("Invalid or expired token");
        }
        req.decoded = decoded;
        next();
      });
    };

    // veyfy admin

    const veryfyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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
    // single page api
    app.get("/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.findOne(query);
      res.send(result);
    });
    // update
    app.patch("/doctors/:id", async (req, res) => {
      const doctors = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: doctors.name,
          image: doctors.image,
          fees: parseFloat(doctors.fees),
          speciality: doctors.speciality,
          about: doctors.about,
          degree: doctors.degree,
          experience: doctors.experience,
        },
      };
      const result = await doctorsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //user add to cart api
    app.post("/doctors-carts", async (req, res) => {
      const doctorItem = req.body;
      const result = await cartsCollection.insertOne(doctorItem);
      res.send(result);
    });

    app.get("/doctors-carts/:email", async (req, res) => {
      const email = req.params.email;
      // console.log("email", email);
      const query = { email: email };
      // console.log("query", query);
      const result = await cartsCollection.find(query).toArray();
      // console.log("result", result);
      res.send(result);
    });

    app.delete("/doctors-carts/:email", veryfyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/users/:email", veryfyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // end

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

    app.get("/users", veryfyToken, veryfyAdmin, async (req, res) => {
      // const user = req.body;
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // user delete from database
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      veryfyToken,
      veryfyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.get("/users/admin/:email", veryfyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send("unauthorized access");
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.delete("/doctors/:id", veryfyToken, veryfyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.deleteOne(query);
      res.send(result);
    });
    // payment
    app.post("/create-checkout-session", async (req, res) => {
      const { fees } = req.body;
      const amount = parseInt(fees * 100);
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    app.post("/payment", async (req, res) => {
      const payment = req.body;
      console.log("payment", payment);
      const paymentResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    // load all payment
    app.get("/payments/:email", veryfyToken, async (req, res) => {
      const query = { email: req.params.email };

      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      try {
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // admin state
    app.get("/admin-states", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const allDoctors = await doctorsCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      const payment = await paymentCollection.find().toArray();
      const revenue = payment.reduce((acc, item) => acc + item.fees, 0);
      res.send({ users, allDoctors, orders, revenue });
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
