const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const slug = require("slugs");

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: "Please enter a store name!"
    },
    slug: String,
    description: {
      type: String,
      trim: true
    },
    tags: [String],
    createdAt: {
      type: Date,
      default: Date.now
    },
    location: {
      type: {
        type: String,
        default: "Point"
      },
      coordinates: [
        {
          type: Number,
          required: "You must supply coordinates!"
        }
      ],
      address: {
        type: String,
        required: "You must supply an address!"
      }
    },
    photo: String,
    author: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: "You must supply an author"
    }
  },
  {
    toJSON: { virtuals: true }, // Faz a propriedade aparecer quando printa na tela
    toObject: { virtuals: true } // o campo tá lá, mas invisel, a menos que faça isso
  }
);

// -----------------------------------------------------------------------------
// Usar $text quando for realizar consultas (storeController::searchStore)
storeSchema.index({
  name: "text",
  description: "text"
});

storeSchema.index({
  location: "2dsphere"
});

storeSchema.pre("save", async function(next) {
  if (!this.isModified("name")) {
    next();
    return;
  }

  this.slug = slug(this.name);

  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  // we don't have the class Store here, so we use this.constructor

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
});

storeSchema.statics.getTagsList = function() {
  // ---------------------------------------------------------------------------
  // Query complexas como se fosse moleza :P
  return this.aggregate([
    { $unwind: "$tags" }, // break by tags
    { $group: { _id: "$tags", count: { $sum: 1 } } }, // group by tag, sum 1 for each of them
    { $sort: { count: -1 } } // -1 descending, 1 ascending
  ]);
};

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Proura as lojas e retorna os reviews
    {
      $lookup: {
        from: "reviews", // é o model Review. O mongo coloca em minuscula e adiciona o "s"
        localField: "_id",
        foreignField: "store",
        as: "reviews"
      }
    },
    // Filtra as lojas que tem 2 ou mais reviews
    {
      $match: {
        "reviews.1": { $exists: true } // .1 é o segundo item do array de reviews
      }
    },
    // Cria o campo com a média das avaliações
    {
      $project: {
        // mongo >= 3.4 $addField
        photo: "$$ROOT.photo",
        name: "$$ROOT.name",
        slug: "$$ROOT.slug",
        reviews: "$$ROOT.reviews",
        avarageRating: { $avg: "$reviews.rating" }
      }
    },
    // Ordena pela média
    {
      $sort: {
        avarageRating: -1
      }
    },
    // Top 10
    {
      $limit: 10
    }
  ]);
};

storeSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "store"
});

function autopopulate(next) {
  this.populate('reviews')
  next()
}

storeSchema.pre('find', autopopulate)
storeSchema.pre('findOne', autopopulate)

module.exports = mongoose.model("Store", storeSchema);
