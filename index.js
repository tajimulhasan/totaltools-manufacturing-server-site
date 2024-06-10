const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

//middleware
app.use(express.json());
app.use(cors());

//main
app.get("/", (req, res) => {
  res.send("TotalTools-Manufacturing is running");
});



//---------------------------------------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.txucn9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//jwt verifing function
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}


//run function start----------------------------
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //............................all collections starts here...........................
    const productCollection = client
      .db("totaltools_manufacturing")
      .collection("products");

    //for order
    const orderCollection = client
      .db("totaltools_manufacturing")
      .collection("orders");

    //for user
    const usersCollection = client
      .db("totaltools_manufacturing")
      .collection("users");

    //for payment
    const paymentCollection = client
      .db("totaltools_manufacturing")
      .collection("payment");

    //for reviews
    const reviewsCollection = client
      .db("totaltools_manufacturing")
      .collection("reviews");

    //for profileInfo
    const profileInfoCollection = client
      .db("totaltools_manufacturing")
      .collection("profileInfo");

    //for sendMessage
    const contactusCollection = client
      .db("totaltools_manufacturing")
      .collection("contactus");

    //............................all collections ends here...........................


    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    };

   

    //payment-intent for stripe
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const product = req.body;
      const price = product.totalPrice;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });


    //-----------------PRODUCTS-------------------------------------------


    //post product
    app.post("/products", verifyJWT, verifyAdmin, async (req, res) => {
      const newProduct = req.body;
      const result = await productCollection.insertOne(newProduct);
      res.send(result);
    });

    //get all products
    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });


    //get single product by id
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const product = await productCollection.findOne(query);
      res.send(product);
    });

    //product available quntity update
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const products = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          availableQuantity: products.availableQuantity,
        },
      };
      const result = await productCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });


//product update:
 app.patch("/product/:id", verifyJWT, verifyAdmin, async(req, res)=>{
  const id = req.params.id;
  const productData = req.body;
  const {productName,
    shortDescription,
    moQuantity,
    availableQuantity,
    price,
    picture} = productData;
  const filter = {_id: new ObjectId(id)};
  const updateDoc = {
    $set: {
      productName,
      shortDescription,
      moQuantity,
      availableQuantity,
      price,
      picture
    }
  }
  const result = await productCollection.updateOne(filter, updateDoc);
  res.send(result);
 });


    //delete product
    app.delete("/products/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });
// -----------------PRODUCT api end-------------------------



    //-------------USER api-------------------------------------
    //load all user
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    //find one admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    //make admin
    app.put("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //uesrs check jwt and put 
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      res.send({ result, accessToken: token });
    });


    // delete user
    app.delete("/users/:email", verifyJWT, verifyAdmin, async (req, res)  => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
 //-------------USER api end-------------------------------------

 //-------------Order api start-------------------------------------
    //post an order
    app.post("/orders", async (req, res) => {
      const newOrder = req.body;
      const result = await orderCollection.insertOne(newOrder);
      res.send(result);
    });

    //get all orders
    app.get("/allOrders", verifyJWT, async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.status(200).send(result);
    });

    //get an order
    app.get("/orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const order = await cursor.toArray();
        res.send(order);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });

    //patch for paid order
    app.patch("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "paid",
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await orderCollection.updateOne(filter, updateDoc);
      res.send(updatedOrder);
    });

    app.patch("/manageAllOrders/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Shipped",
        },
      };
      const updateStatus = await orderCollection.updateOne(filter, updateDoc);
      res.send(updateStatus);
    });

    app.get("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    //delete order
    app.delete("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });
 //-------------Order api end-------------------------------------
 
 
 //-------------Review api start-------------------------------------

    //Reviews post
    app.post("/reviews", verifyJWT, async (req, res) => {
      const newReview = req.body;
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });

  //get own reviews
    app.get("/reviews", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const cursor = reviewsCollection.find(filter);
      const result = await cursor.toArray();
      res.send(result);
    });
 //-------------Review api end-------------------------------------


 //-------------profile api start-------------------------------------
    //Profile info post
    app.post("/profile", async (req, res) => {
      const newProfile = req.body;
      const result = await profileInfoCollection.insertOne(newProfile);
      res.send(result);
    });

  //get profile by email
    app.get("/profile/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await profileInfoCollection.findOne(filter);
      res.send(result);
    });

    //update profile
    app.put("/profile/:email", async (req, res) => {
      const email = req.params.email;
      const profile = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: profile,
      };
      const result = await profileInfoCollection.updateOne(
        filter,
        updateDoc,
        option
      );
      res.send(result);
    });
 //-------------profile api end-------------------------------------

//------------------------Contact us send message---------------------------------
app.post("/contactus", verifyJWT, async(req, res) => {
         const newContact = req.body;
         const result = await contactusCollection.insertOne(newContact);
         res.send(result);
});


  } 
  finally {
  
  }
}
run().catch(console.dir);

//---------------------------------------------------

app.listen(port, () => {
  console.log(`tataltools-manufacturing server is running ${port}`);
});
