module.exports = function (roles) {
  return (req, res, next) => {
    console.log(req.user.role);
    console.log(roles);
    const role = req.user.role.trim();
    try{
      
    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Access denied" });
    }
  
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  };
};
};