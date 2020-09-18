const bcrypt = require("bcryptjs");

const plainTextPassword = "<enter password here>";

bcrypt.hash(plainTextPassword, 8, function (err, hash) {
  console.log(hash);
});
