const bcrypt = require("bcryptjs");

const plainTextPassword = "kukkapurkkimies";

bcrypt.hash(plainTextPassword, 8, function (err, hash) {
  console.log(hash);
});
