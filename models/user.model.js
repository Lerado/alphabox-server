"use strict"

let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let UserSchema = new Schema({
	username: {
		type: String,
		unique: true,
		index: true,
		lowercase: true,
		required: "Please fill in a username",
		trim: true
	},
	password: {
		type: String,
		required: "Please fill in a password"
	},
	firstName: {
		type: String,
		trim: true,
		default: ""
	},
	lastName: {
		type: String,
		trim: true,
		default: ""
	},
	email: {
		type: String,
		trim: true,
		unique: true,
		index: true,
		lowercase: true,
		required: "Please fill in an email"
	}
}, {
	timestamps: true
});

module.exports = mongoose.model("User", UserSchema);
