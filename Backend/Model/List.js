// models/ListModel.js
const mongoose = require("mongoose");

const listSchema = new mongoose.Schema({
  name: String,
  price: Number,
  percent: String,
  isDown: Boolean,
});

const ListModel = mongoose.model("List", listSchema); // Use "List" as collection name

module.exports = ListModel;
