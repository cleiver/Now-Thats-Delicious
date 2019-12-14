const passport = require("passport");
const crypto = require("crypto");
const promisify = require("es6-promisify");
const mongoose = require("mongoose");
const mail = require("../handlers/mail");

const User = mongoose.model("User");

exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "⚠ Login failed ⚠",
  successRedirect: "/",
  successFlash: "Welcome! 🎉"
});

exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "Good bye! 👋");
  res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  req.flash("error", "You must be logged in to view this page! ✋");
  res.redirect("/login");
};

exports.forgot = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "Could not locate this email. Is it correct?");
    res.redirect("/login");
  }

  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000;

  await user.save();

  const resetURL = `${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user,
    subject: "Your password reset link! 🖇",
    resetURL,
    filename: "password-reset"
  });
  req.flash("success", "We just mailed you a reset link ✉");

  res.redirect("/login");
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash("error", "Your token is invalid or is expired!");
    res.redirect("/login");
  }

  res.render("reset", { title: "Create your new password" });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body["password-confirm"]) {
    return next();
  }

  req.flash("error", "Passwords do not match!");
  res.redirect("back");
};

exports.updatePassword = async (req, res) => {
  // refatorar essa consulta
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash("error", "Your token is invalid or is expired!");
    res.redirect("/login");
  }

  // ---------------------------------------------------------------------------
  // .setPassword e .login fazem parte do passport
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);

  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  await req.login(updatedUser);

  req.flash(
    "success",
    "Your password has been reset and you are now logged in! 💃"
  );
  res.redirect("/");
};
