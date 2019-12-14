const express = require("express");
const router = express.Router();

const { catchErrors } = require("../handlers/errorHandlers");

const storeController = require("../controllers/storeController");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const reviewController = require("../controllers/reviewController");

router.get("/", catchErrors(storeController.getStores));

router.get("/stores", catchErrors(storeController.getStores));
router.get("/stores/page/:page", catchErrors(storeController.getStores));
router.get("/stores/:slug", catchErrors(storeController.getStoreBySlug));
router.get("/stores/:id/edit", catchErrors(storeController.editStore));

router.get("/add", authController.isLoggedIn, storeController.addStore);
router.post(
  "/add",
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.createStore)
);
router.post(
  "/add/:id",
  storeController.upload,
  catchErrors(storeController.resize),
  storeController.updateStore
);

router.get("/tags", catchErrors(storeController.getStoresByTag));
router.get("/tags/:tag", catchErrors(storeController.getStoresByTag));

router.get("/map", storeController.mapPage);

router.get("/login", userController.loginForm);
router.post("/login", authController.login);
router.get("/logout", authController.logout);
router.get("/register", userController.registerForm);
router.post(
  "/register",
  userController.validateRegister,
  userController.register,
  authController.login
);

router.get("/account", authController.isLoggedIn, userController.account);
router.post("/account", catchErrors(userController.updateAccount));
router.post("/account/forgot", catchErrors(authController.forgot));
router.get("/account/reset/:token", catchErrors(authController.reset));
router.post(
  "/account/reset/:token",
  authController.confirmedPasswords,
  catchErrors(authController.updatePassword)
);
router.post(
  "/hearts",
  authController.isLoggedIn,
  catchErrors(storeController.getHearts)
);
router.post(
  "/reviews/:id",
  authController.isLoggedIn,
  reviewController.addReview
);
router.get("/top", catchErrors(storeController.getTopStores));

router.get("/api/search", catchErrors(storeController.searchStores));
router.get("/api/stores/near", catchErrors(storeController.mapStores));
router.post("/api/stores/:id/heart", catchErrors(storeController.heartStore));

module.exports = router;
