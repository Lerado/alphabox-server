"use strict";

// Errors handler
const { MoleculerClientError } = require("moleculer").Errors;
// Bcrypt for password crypting
const bcrypt = require("bcrypt");
// JWT based authentication system
const jwt = require("jsonwebtoken");
// Database management
const DbMixin = require("../mixins/db.mixin");
// User model
const User = require("../models/user.model");

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
	name: "users",
	// version: 1,

	/**
	 * Mixins
	 */
	mixins: [DbMixin("users", User)],

	/**
	 * Settings
	 */
	settings: {
		// Secret for JWT
		JWT_SECRET: process.env.JWT_SECRET || "jwt-alphabox",

		// Available fields in the responses
		fields: [
			"_id",
			"username",
			"email"
		],

		// Validator for the `create` & `insert` actions.
		entityValidator: {
			username: "string|min:3",
			password: "string|min:6",
			password_confirmation: { type: "equal", field: "password"},
			email: "email",
		}
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * The "moleculer-db" mixin registers the following actions:
		 *  - list
		 *  - find
		 *  - count
		 *  - create
		 *  - insert
		 *  - update
		 *  - remove
		 */

		// --- ADDITIONAL ACTIONS ---

		/**
		 * Register a new user
		 *
		 * @actions
		 * @param {Object} user - User entity to register
		 *
		 * @return {Object} user - Created entity + token
		 */
		create: {
			rest: "POST /",
			params: {
				user: {
					type: "object",
					props: {
						username: { type: "string" },
						password: { type: "string" },
						password_confirmation: { type: "equal", field: "password", strict: true },
						email: { type: "email" },
					}
				}

			},
			async handler(ctx) {
				let entity = ctx.params.user;
				await this.validateEntity(entity); // Data validation

				// Checks if username already exists in db
				if (entity.username) {
					const found = await this.adapter.findOne({ username: entity.username });
					if (found)
						throw new MoleculerClientError("Username already exists", 422, "", [{ field: "username", message: "already exists" }]);
				}

				// Same check for email
				if (entity.email) {
					const found = await this.adapter.findOne({ email: entity.email });
					if (found)
						throw new MoleculerClientError("Email already exists", 422, "", [{ field: "email", message: "already exists" }]);
				}

				entity.password = bcrypt.hashSync(entity.password, 10); // Hash password
				entity.created_at = new Date();

				// Insert, set token and return JSON data
				const document = this.adapter.insert(entity);
				const user = this.transformDocuments(ctx, {}, document);
				const json = this.transformEntity(user, true, ctx.meta.token);
				await this.entityChanged("created", json, ctx);

				return json;
			}
		},

		/**
		 * Login with username with password
		 *
		 * @actions
		 * @param {Object} user - User credentials
		 *
		 * @returns {Object} Logged in user with token
		 */
		login: {
			rest: "POST /login",
			params: {
				user: {
					type: "object",
					props: {
						username: { type: "string", min: 4 },
						password: { type: "string", min: 6 }
					}
				}
			},
			async handler(ctx) {
				// const { username, password } = ctx.params.user;
				const { username, password } = ctx.params;
				const user = await this.adapter.findOne({ username });	// User in database

				// If user not find
				if (!user)
					throw new MoleculerClientError("Username or password is invalid!", 422, "", [{ field: "username", message: "is not found" }]);

				// Compare password to result in db
				const res = await bcrypt.compare(password, user.password);
				if (!res)
					throw new MoleculerClientError("Wrong password", 422, "", [{ field: "password", message: "is wrong" }])

				// Transform user entity (remove password and all protected fields)
				const doc = await this.transformDocuments(ctx, {}, user);
				const response = await this.transformEntity(doc, true, ctx.meta.token);

				// Responses headers with http-only cookie containing the token
				ctx.meta.$responseHeaders = {
					"Set-Cookie": `Authorization=Bearer-${ response.user.token };SameSite=None;Secure`
				};

				return response;
			}
		},

		/**
		 * Get user by JWT token
		 *
		 * @actions
		 * @param {String} token - JWT token
		 *
		 * @returns {Object} Resolved user
		 */
		resolveJWT: {
			cache: {
				keys: ["token"],
				ttl: 60 * 60 // an hour
			},
			params: {
				token: "string"
			},
			async handler(ctx) {
				// Decode token and verify its validity
				const decoded = await new this.Promise((resolve, reject) => {
					jwt.verify(ctx.params.token, this.settings.JWT_SECRET, (err, decoded) => {
						if (err)
							return reject(err);

						resolve(decoded);
					});
				});

				if (decoded.id)
					return this.getById(decoded.id);
			}
		},

		/**
		 * Get the authenticated user
		 *
		 * @actions
		 *
		 * @throws {UnAuthorizedError}
		 * @returns {User} The authenticated
		 */
		resolveAuthenticated: {
			rest: "GET /resolve",
			auth: "required",
			async handler(ctx) {
				// Middleware has already checked authentication here, see api.service.js@authorize
				// The authenticated user is loaded in ctx.meta
				const doc = await this.transformDocuments(ctx, {}, ctx.meta.user);
				const response = await this.transformEntity(doc, true, ctx.meta.token);

				return response;
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Generate a JWT token from user entity
		 *
		 * @param {Object} user
		 */
		generateJWT(user) {
			// Computed expiration date to 60 days
			const today = new Date();
			const expiration = new Date(today);
			expiration.setDate(today.getDate() + 60);

			return jwt.sign({
				id: user._id,
				username: user.username,
				exp: Math.floor(expiration.getTime() / 1000)
			}, this.settings.JWT_SECRET);
		},

		/**
		 * Transform returned user entity. Generate JWT token if necessary.
		 *
		 * @param {Object} user
		 * @param {Boolean} withToken
		 */
		transformEntity(user, withToken, token) {
			if (user) {
				if (withToken)
					user.token = token || this.generateJWT(user);
			}

			return { user };
		}
	},

	/**
	 * Fired after database connection establishing.
	 */
	async afterConnected() {
		// await this.adapter.collection.createIndex({ name: 1 });
	}
};
