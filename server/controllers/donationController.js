const Donation = require("../models/Donation");

/* ==============================
   Create Donation
================================ */
exports.createDonation = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({
        message: "Only restaurants can create donations"
      });
    }

    const { foodName, quantity, pickupLocation, expiryTime } = req.body;

    if (!foodName || !quantity || !pickupLocation || !expiryTime) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    /* Validate quantity */
    const parsedQty = Number(quantity);

    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number"
      });
    }

    /* Validate expiry date */
    const expiry = new Date(expiryTime);

    if (isNaN(expiry.getTime())) {
      return res.status(400).json({
        message: "Invalid expiry time format"
      });
    }

    if (expiry <= new Date()) {
      return res.status(400).json({
        message: "Expiry time must be in the future"
      });
    }

    /* Standardized image path */
    const image = req.file?.path || null;

    const donation = await Donation.create({
      restaurant: req.user.id,
      foodName,
      quantity: parsedQty,
      pickupLocation,
      expiryTime: expiry,
      image
    });

    res.status(201).json({
      message: "Donation created successfully",
      donation
    });

  } catch (error) {

    console.error("CREATE DONATION ERROR:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};


/* ==============================
   Get All Donations
================================ */
exports.getDonations = async (req, res) => {
  try {

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const skip = (page - 1) * limit;

    const filter = {
      status: "available",
      expiryTime: { $gt: new Date() }
    };

    const total = await Donation.countDocuments(filter);

    const donations = await Donation.find(filter)
      .populate("restaurant", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      donations
    });

  } catch (error) {

    console.error("GET DONATIONS ERROR:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};


/* ==============================
   Get My Donations
================================ */
exports.getMyDonations = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const donations = await Donation.find({
      restaurant: req.user.id
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ donations });

  } catch (error) {

    console.error("GET MY DONATIONS ERROR:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};


/* ==============================
   Delete Donation
================================ */
exports.deleteDonation = async (req, res) => {
  try {

    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found"
      });
    }

    if (donation.restaurant.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Not authorized to delete this donation"
      });
    }

    if (["reserved", "picked"].includes(donation.status)) {
      return res.status(400).json({
        message: "Cannot delete a donation that is already reserved or picked up"
      });
    }

    await donation.deleteOne();

    res.status(200).json({
      message: "Donation deleted successfully"
    });

  } catch (error) {

    console.error("DELETE DONATION ERROR:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};