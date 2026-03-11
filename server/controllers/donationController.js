const Donation = require("../models/Donation");

/* ==============================
   Create Donation
================================ */
exports.createDonation = async (req, res) => {
  try {

    // Role guard — only restaurants can donate
    if (req.user.role !== "restaurant") {
      return res.status(403).json({
        message: "Only restaurants can create donations"
      });
    }

    const { foodName, quantity, pickupLocation, expiryTime } = req.body;

    // Validate all required fields including expiryTime
    if (!foodName || !quantity || !pickupLocation || !expiryTime) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    // Ensure expiryTime is not in the past
    if (new Date(expiryTime) <= new Date()) {
      return res.status(400).json({
        message: "Expiry time must be in the future"
      });
    }

    const donation = await Donation.create({
      restaurant: req.user.id,
      foodName,
      quantity,
      pickupLocation,
      expiryTime
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

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Only return available, non-expired donations
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
   Get My Donations (Restaurant)
================================ */
exports.getMyDonations = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const donations = await Donation.find({ restaurant: req.user.id })
      .sort({ createdAt: -1 });

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

    // Only the owning restaurant can delete
    if (donation.restaurant.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Not authorized to delete this donation"
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