const Donation = require("../models/Donation");

/* ==============================
   Create Donation
================================ */
exports.createDonation = async (req, res) => {
  try {
    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can create donations" });
    }

    // Added 'location' to destructuring (Expected as [lng, lat] from frontend)
    const { foodName, quantity, pickupLocation, expiryTime, location } = req.body;

    if (!foodName || !quantity || !pickupLocation || !expiryTime || !location) {
      return res.status(400).json({ message: "Please fill all required fields, including location" });
    }

    const parsedQty = Number(quantity);
    if (isNaN(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ message: "Quantity must be a positive number" });
    }

    const expiry = new Date(expiryTime);
    if (isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ message: "Invalid or past expiry time" });
    }

    const image = req.file?.path || null;

    const donation = await Donation.create({
      restaurant: req.user.id,
      foodName,
      quantity: parsedQty,
      pickupLocation,
      location: {
        type: "Point",
        coordinates: location // Ensure frontend sends [longitude, latitude]
      },
      expiryTime: expiry,
      image
    });

    // ==========================================
    // SOCKET.IO REAL-TIME BROADCAST
    // ==========================================
    // Notify all users that new food is available
    req.io.emit("new_donation", {
        message: `New food available: ${foodName}`,
        donation: await donation.populate("restaurant", "name")
    });

    res.status(201).json({
      message: "Donation created successfully",
      donation
    });

  } catch (error) {
    console.error("CREATE DONATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ==============================
   Get All Donations
================================ */
exports.getDonations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
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
    res.status(500).json({ message: "Server error" });
  }
};

/* ==============================
   Get My Donations
================================ */
exports.getMyDonations = async (req, res) => {
  try {
    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Access denied" });
    }

    const donations = await Donation.find({ restaurant: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({ donations });
  } catch (error) {
    console.error("GET MY DONATIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ==============================
   Delete Donation
================================ */
exports.deleteDonation = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({ message: "Donation not found" });
    }

    if (donation.restaurant.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (["reserved", "picked"].includes(donation.status)) {
      return res.status(400).json({ message: "Cannot delete reserved/picked food" });
    }

    await donation.deleteOne();

    // Notify clients that a donation was removed
    req.io.emit("donation_deleted", { id: req.params.id });

    res.status(200).json({ message: "Donation deleted successfully" });
  } catch (error) {
    console.error("DELETE DONATION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};