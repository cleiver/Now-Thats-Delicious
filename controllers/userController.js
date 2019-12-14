const promisify = require("es6-promisify");
const mongoose = require("mongoose");

const User = mongoose.model("User");

exports.loginForm = (req, res) => {
  res.render("login", { title: "Login" });
};

exports.registerForm = (req, res) => {
  res.render("register", { title: "Create your account" });
};

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name });

  // -----------------------------------------------------------------------------
  // .register foi criado pelo plugin passport definido no User Model
  // Estamos criando uma versão em promise do método pois ele não foi
  // atualizado pelo autor do pacote ainda
  const register = promisify(User.register, User);
  await register(user, req.body.password);

  // -----------------------------------------------------------------------------
  // Passa para o próximo método da fila, definido nas rotas
  next();
};

exports.account = async (req, res) => {
  res.render("account", { title: "Edit your account" });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email
  };

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: updates },
    { new: true, runValidators: true, context: "query" }
  );

  req.flash("success", "Profile updated!");
  res.redirect("back");
};

// -----------------------------------------------------------------------------
// Esses middlewares estão aqui mas acho que poderiam ser um módulo a parte

exports.validateRegister = (req, res, next) => {
  // -----------------------------------------------------------------------------
  // .sanitizeBody é um dos métodos do objeto express-validator (app.js)
  req.sanitizeBody("name");
  req.checkBody("name", "You must supply your name!").notEmpty();
  req.checkBody("email", "You must supply an email address!").notEmpty();
  req.checkBody("email", "This email is invalid!").isEmail();
  req.sanitizeBody("email").normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false
  });
  req.checkBody("password", "Password cannot be blank!").notEmpty();
  req
    .checkBody("password-confirm", "Confirm password cannot be blank!")
    .notEmpty();
  req
    .checkBody("password-confirm", "Your password does not match!")
    .equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    req.flash(
      "error",
      errors.map(err => err.msg)
    );
    res.render("register", {
      title: "Create your account",
      body: req.body,
      flashes: req.flash()
    });
    return;
  }

  next();
};
