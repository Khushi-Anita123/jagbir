const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },  // later you can use ObjectId ref to User
  products: [
    {
      name: String,
      desc: String,
      price: Number,
      image: String,
      quantity: { type: Number, default: 1 }
    }
  ]
});

module.exports = mongoose.model("Cart", cartSchema);
