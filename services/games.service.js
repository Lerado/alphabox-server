"use strict"

// Filesystem library
const fs = require('fs');
// Errors handler
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * @typedef {import('moleculer').Context} Context Moleculer context
 */

module.exports = {
	name: "games",
	// version: 1,

	/**
	 * Mixins
	 */
	mixins: [],

	/**
	 * Settings
	 */
	settings: {
		GAMES_DATA_DIR: "data/games",
	},

	/**
	 * Metadata
	 */
	metadata: {
		/**
		 * Different games organized by increasing level
		 */
		games: {}
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Get game settings for a given language and level
		 *
		 * @actions
		 * @param {String} lang
		 * @param {Number} number
		 */
		settings: {
			rest: "GET /lang/:lang/level/:level",
			auth: "required",
			params: {
				lang: "string",
				level: "string"
			},
			async handler(ctx) {
				const { lang, level } = ctx.params;
				return this.getSettings(ctx, lang, level);
			}
		},

		/**
		 * Get game settings for a given language and level
		 * Demo version, so no auth check
		 *
		 * @actions
		 * @param {String} lang
		 * @param {Number} number
		 */
		demoSettings: {
			rest: "GET /demo/lang/:lang/level/:level",
			params: {
				lang: "string",
				level: "string"
			},
			async handler(ctx) {
				const { lang, level } = ctx.params;

				// Allow demo only for the first five levels
				if (level >= 5)
					throw new MoleculerClientError(`Level ${ level } is not allowed to unauthenticated users`, 401, [{ field: "level", message: "is not allowed for unauthenticated users" }]);

				return this.getSettings(ctx, lang, level);
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {
		// Get the settings for a level of the game
		async getSettings(ctx, lang, level) {
			// Checks if language is supported by the languages service
			const languageExist = await ctx.call("languages.checkLanguage", { lang });
			if (!languageExist)
				throw new MoleculerClientError(`Language ${ lang } is not supported`, 404, "", [{ field: "lang", message: "is not supported" }]);

			// Does level exist already
			if (!this.metadata.games[lang].hasOwnProperty(level))
				throw new MoleculerClientError(`Level ${ level } does not exist for language ${ lang }`, 404, "", [{ field: "level", message: "does not exist" }]);

			const response = this.metadata.games[lang][level];

			return response;
		}
	},

	/**
	 * Service created lifecycle event handler
	 *
	 * @see languages.service@created
	 */
	created() {
		let directory = fs.opendirSync(this.settings.GAMES_DATA_DIR);

		let game;
		while (game = directory.readSync()) {
			if (game.isFile() && game.name.endsWith('.json')) {
				const filename = game.name.replace(".json", "");
				game = fs.readFileSync(`${ directory.path }/${ game.name }`);
				this.metadata.games[`${ filename }`] = JSON.parse(game);
			}
		}
		directory.closeSync(); // Never forget this
	}
}
