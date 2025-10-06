const jwt = require("jsonwebtoken");
const UserNew = require("../models/UserNew");

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
            
            // Try UserNew model first
            let user = await UserNew.findById(decoded.id).select("-password");
            
            // If not found, try old User model
            if (!user) {
                const User = require("../models/User");
                user = await User.findById(decoded.id).select("-password");
            }
            
            if (user) {
                // Check if user account is active
                if (user.isActive === false) {
                    return res.status(403).json({ 
                        message: "Account is deactivated. Please contact administrator for assistance." 
                    });
                }
                
                req.user = user;
                next();
            } else {
                res.status(401).json({ message: "User not found" });
            }
        } else {
            res.status(401).json({ message: "Not authorized, no token" });
        }
    } catch (error) {
        res.status(401).json({ message: "Token failed", error: error.message });
    }
};

// Middleware for Admin access
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied, admin access required" });
    }
};

// Middleware for Master Trainer access
const masterTrainerOnly = (req, res, next) => {
    if (req.user && (req.user.role === "master_trainer" || req.user.role === "admin")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied, master trainer access required" });
    }
};

// Middleware for Trainer access
const trainerOnly = (req, res, next) => {
    if (req.user && (req.user.role === "trainer" || req.user.role === "master_trainer" || req.user.role === "admin")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied, trainer access required" });
    }
};

// Middleware for Trainee access
const traineeOnly = (req, res, next) => {
    if (req.user && (req.user.role === "trainee" || req.user.role === "admin")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied, trainee access required" });
    }
};

// Middleware for BOA access
const boaOnly = (req, res, next) => {
    if (req.user && (req.user.role === "boa" || req.user.role === "admin")) {
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

module.exports = { protect, adminOnly, masterTrainerOnly, trainerOnly, traineeOnly, boaOnly, requireRoles };
