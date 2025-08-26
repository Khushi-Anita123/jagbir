const express = require('express');
const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const Cart = require("../models/cart");
// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// -------------------- SIGNUP --------------------
const Signup=async (req, res) => {
    try {
        let { name, email, password, dateOfBirth } = req.body;
        if (!name || !email || !password || !dateOfBirth)
            return res.json({ status: "FAILED", message: "Empty input fields" });

        name = name.trim();
        email = email.trim();
        password = password.trim();
        dateOfBirth = dateOfBirth.trim();
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.json({ status: "FAILED", message: "User already exists" });
        const hashedPassword = await bcrypt.hash(password, 10);
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            dateOfBirth,
            verificationToken: token
        });
        await newUser.save();
        const url = `${process.env.BASE_URL}/verifytoken/${token}`;
        await transporter.sendMail({
         from: `"Single User" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your email',
        html: `<h3>Click <a href="${url}">here</a> to verify your email</h3>`
        });

        res.json({ status: "SUCCESS", message: "Signup successful. Check your email to verify." });

    } catch (err) {
        console.log(err);
        res.json({ status: "FAILED", message: "Server error" });
    }
}

// -------------------- EMAIL VERIFICATION --------------------
const Verifytoken= async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findOne({ email: decoded.email, verificationToken: token });
        if (!user) return res.send('Invalid token');

        user.isVerified = true;
        user.verificationToken = null;
        await user.save();
        res.redirect('/login.html');
    } catch (err) {
        console.log(err);
        res.send('Invalid or expired token');
    }
}
// -------------------- LOGIN --------------------
const Login=async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.json({ status: "FAILED", message: "Empty input fields" });

        const user = await User.findOne({ email });
        if (!user) return res.json({ status: "FAILED", message: "User not found" });
        if (!user.isVerified) return res.json({ status: "FAILED", message: "Email not verified" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ status: "FAILED", message: "Invalid password" });

        res.json({ status: "SUCCESS", message: "Login successful", redirect: "/e-commerce.html" });

    } catch (err) {
        console.log(err);
        res.json({ status: "FAILED", message: "Server error" });
    }
}
let otpStore = {};
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });


    const otp = Math.floor(100000 + Math.random() * 900000); 
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

   
    // const transporter = nodemailer.createTransport({
    //   service: "gmail",
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   }
    // });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP is ${otp}. It is valid for 5 minutes.`
    });

    res.json({ msg: 'OTP sent to email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};
//---------------CHANGE PASSWORD----------------------
const verifyOtpAndChangePassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const otpData = otpStore[email];
    if (!otpData) return res.status(400).json({ msg: 'OTP not requested' });

    if (Date.now() > otpData.expires) {
      delete otpStore[email];
      return res.status(400).json({ msg: 'OTP expired' });
    }

    if (parseInt(otp) !== otpData.otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.updateOne({ email }, { $set: { password: hashedPassword } });
    delete otpStore[email];

    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};
//--------------SUBSCRIBE-----------------
const subscribe=async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    await transporter.sendMail({
      from: `"Pottery Shop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Pottery Collaboration 🤝",
      text: `Hello, welcome to our pottery community! 
      We’re excited to collaborate with you.`,
      html: `<h2>Welcome!</h2>
             <p>Thanks for collaborating with us. Stay tuned for exciting updates.</p>`
    });
    res.json({ message: 'Welcome email sent successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending email' });
  }
}
//---------------ADD CART--------------
const add=async (req, res) => {
  try {
    const { email, product } = req.body;

    // find cart for user
    let cart = await Cart.findOne({userEmail:email });

    if (!cart) {
      cart = new Cart({ userEmail:email, products: [product] });
    } else {
      cart.products.push(product);
    }

    await cart.save();
    res.status(200).json({ message: "Product added to cart!", cart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
//--------------MY CART-------------
const getCartByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const cart = await Cart.findOne({ userEmail: email });

    if (!cart || cart.products.length === 0) {
      return res.json({ message: "Cart is empty", products: [] });
    }

    res.json({ products: cart.products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
    Signup,
    Verifytoken,
    Login,
    forgotPassword,
    verifyOtpAndChangePassword,
    subscribe,
    add,
    getCartByEmail
  }
