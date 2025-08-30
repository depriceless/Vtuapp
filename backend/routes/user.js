const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth"); // your JWT auth middleware

const router = express.Router();

/**
 * PUT /api/user/change-password
 * Protected route - requires JWT token
 */
router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both old and new password are required",
      });
    }

    // Fetch user including password
    const user = await User.findById(req.user.userId).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Old password is incorrect" });

    // Set new password directly; pre-save hook will hash it
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password updated for user: ${user.email}`);

    res.status(200).json({ success: true, message: "Password updated successfully" });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Server error updating password" });
  }
});


module.exports = router;
