const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AuthValidationError = require("../errors/auth-validation-error");
const AuthenticationError = require("../errors/auth-authentication-error");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_EXPIRATION = "7d";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET não configurado");
  return value;
}

function validateSignUp(input) {
  const details = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!name || name.length > 120) details.name = "Informe um nome com até 120 caracteres";
  if (!email || email.length > 180 || !EMAIL_PATTERN.test(email)) details.email = "Informe um e-mail válido";
  if (password.length < 8) details.password = "A senha deve ter ao menos 8 caracteres";

  if (Object.keys(details).length) throw new AuthValidationError(details);
  return { name, email, password };
}

function validateLogIn(input) {
  const details = {};
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!email) details.email = "Informe o e-mail";
  if (!password) details.password = "Informe a senha";

  if (Object.keys(details).length) throw new AuthValidationError(details);
  return { email, password };
}

function issueToken(user) {
  return jwt.sign({ userId: user.id }, secret(), { expiresIn: TOKEN_EXPIRATION });
}

function createAuthService(repository) {
  async function signUp(input) {
    const { name, email, password } = validateSignUp(input ?? {});
    if (await repository.findByEmail(email)) {
      throw new AuthValidationError({ email: "Este e-mail já está cadastrado" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await repository.create({ name, email, passwordHash });
    return { token: issueToken(user), user };
  }

  async function logIn(input) {
    const { email, password } = validateLogIn(input ?? {});
    const user = await repository.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthenticationError("E-mail ou senha incorretos");
    }
    const { passwordHash, ...publicUser } = user;
    return { token: issueToken(publicUser), user: publicUser };
  }

  function verifyToken(token) {
    if (!token) throw new AuthenticationError("Token ausente");
    try {
      const payload = jwt.verify(token, secret());
      return { userId: String(payload.userId) };
    } catch (error) {
      throw new AuthenticationError("Token inválido ou expirado");
    }
  }

  return Object.freeze({ logIn, signUp, verifyToken });
}

module.exports = createAuthService;
