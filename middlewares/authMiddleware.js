const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to protect routes
const protect = async (req, res, next) => {
    try {
        let token = req.headers.authorization;

        // Check for token in Authorization header first
        if (token && token.startsWith("Bearer")) {
            token = token.split(" ")[1]; // Extract token
        } 
        // If no token in header, check for cookie
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next();
        } else {
            res.status(401).json({ message: "Not authorized, no token" });
        }
    } catch (error) {
        res.status(401).json({ message: "Token failed", error: error.message });
    }
};

// Middleware for Master Trainer access
const masterTrainerOnly = (req, res, next) => {
    if (req.user && req.user.role === "master_trainer") {
        next();
    } else {
        res.status(403).json({ message: "Access denied, master trainer only" });
    }
};

// Middleware for Trainer access
const trainerOnly = (req, res, next) => {
    if (req.user && (req.user.role === "trainer" || req.user.role === "master_trainer")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied, trainer access required" });
    }
};

// Middleware for Trainee access
const traineeOnly = (req, res, next) => {
    if (req.user && req.user.role === "trainee") {
        next();
    } else {
        res.status(403).json({ message: "Access denied, trainee access required" });
    }
};

// Middleware for BOA access
const boaOnly = (req, res, next) => {
    if (req.user && req.user.role === "boa") {
        next();
    } else {
        res.status(403).json({ message: "Access denied, BOA access required" });
    }
};

// Middleware for multiple role access
const requireRoles = (roles) => {
    return (req, res, next) => {
        if (req.user && roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ message: `Access denied, required roles: ${roles.join(", ")}` });
        }
    };
};

module.exports = { protect, masterTrainerOnly, trainerOnly, traineeOnly, boaOnly, requireRoles };
