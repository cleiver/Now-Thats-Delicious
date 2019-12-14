// -----------------------------------------------------------------------------
// Dependências do controller
// multer trata formulários do tipo multipart form-data
// jimp faz redimensionamento de imagens
const mongoose = require("mongoose");
const multer = require("multer");
const jimp = require("jimp");
const uuid = require("uuid");

const Store = mongoose.model("Store");
const User = mongoose.model("User");

// -----------------------------------------------------------------------------
// Armazenamento em memória pois não armazenamos a imagem orignal, apenas
// a imagem redimensionada
const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter: function(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");

    if (isPhoto) {
      next(null, true); // first parameter is "error"
    } else {
      next({ message: "That filetype isn't allowed!" }, false);
    }
  }
};

exports.homePage = (req, res) => {
  res.render("index");
};

exports.addStore = (req, res) => {
  res.render("editStore", { title: "Add Store" });
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await new Store(req.body).save();

  req.flash(
    "success",
    `Successfully created ${store.name}! Care to leave a review?`
  );

  res.redirect(`/stores/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;

  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit);

  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit);

  if (!stores.length && skip) {
    req.flash(
      "info",
      `Hey! 👋 You asked for page ${page} but that doesn't exist, so I put you on page ${pages}. 😉`
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render("stores", { title: "Stores", stores, page, pages, count });
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate(
    "author reviews"
  );

  // ---------------------------------------------------------------------------
  // Não havendo resultado, interrompe o processamento da rota e passa pro
  // próximo middleware configurado (app.js), que no caso é o tratamento de
  // erros
  if (!store) return next(); // 404

  res.render("store", { title: store.name, store });
};

exports.editStore = async (req, res) => {
  const store = await Store.findOne({ _id: req.params.id });
  confirmAuthor(store, req.user);

  res.render("editStore", { title: `Editing ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  // ---------------------------------------------------------------------------
  // Forçando o tipo como "Point" para o mongo saber tratar corretamente
  // como coordenadas
  req.body.location.type = "Point";

  // ---------------------------------------------------------------------------
  // A opção new = true faz com que o método retorne os dados atualizados (update),
  //    caso contrário retornará o objeto antigo antes da atualização (find)
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true,
    runValidators: true
  }).exec();

  req.flash(
    "success",
    `Successfully updated ${store.name}. <a href="/stores/${store.slug}">View Store ↪</a>`
  );

  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag || "All";
  const tagQuery = req.params.tag || { $exists: true };

  // ---------------------------------------------------------------------------
  // As duas consultas são independentes, então não tem pq esperar cada uma
  // separadamente. O Promise.all retorna após o fim da execução de todas
  // Se uma consulta selva 3s e outra leva 1s, separadamente o tempo de
  // processamento será de 4s, com o Promise.all o tempo total vai ser o
  // mais demorado
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

  res.render("tags", { title: "Tags", tag, tags, stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store.find(
    {
      $text: {
        $search: req.query.q
      }
    },
    {
      score: { $meta: "textScore" } // Cria uma coluna com a pontuação relevante do termo buscado
    }
  ).sort({
    score: { $meta: "textScore" }
  });
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);

  const query = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates
        },
        $maxDistance: 10000 // ten thousands meters / 10km
      }
    }
  };

  const stores = await Store.find(query)
    .select("name description slug location photo")
    .limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render("map", { title: "Map" });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      [operator]: { hearts: req.params.id }
    },
    { new: true }
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts }
  });
  // Outra alternativa seria usar o .populate nos ids da sessão do usuário

  res.render("stores", { title: "Hearted Stores", stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();

  res.render("topStores", { title: "★ Top Stores", stores });
};

// -----------------------------------------------------------------------------
// Funções auxiliares
const confirmAuthor = (store, user) => {
  if (!store.author || !store.author.equals(user._id)) {
    throw Error(
      "You must have created the store registry in order to edit it ✋"
    );
  }
};

// -----------------------------------------------------------------------------
// Esses middlewares estão aqui mas acho que poderiam ser um módulo a parte

// middleware on routes
exports.upload = multer(multerOptions).single("photo");

// middleware on routes
exports.resize = async (req, res, next) => {
  if (!req.file) {
    next();
    return;
  }

  const extension = req.file.mimetype.split("/")[1];
  req.body.photo = `${uuid.v4()}.${extension}`;

  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);

  next();
};
