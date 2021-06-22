"use strict";

// Filesystem import
const fs = require('fs');
// Errors handler
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
	name: "languages",
	// version: 1,

	/**
	 * Mixins
	 */
	mixins: [],

	/**
	 * Settings
	 */
	settings: {
		DICTIONARY_DIR: "data/dictionaries",
	},

	/**
	 * Metadata
	 */
	metadata: {
		/**
		 * Dictionaries for the supported languages
		 * Hopefully contains JSONs of words that aren't
		 * large enough to be memory uncompliant
		 * I said hopefully :)
		 */
		dictionaries: {}
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Get languages supported by the service
		 */
		get: {
			rest: "GET /get",
			async handler(ctx) {
				// Keys from the metadata.dictionaries object normally are the response
				const languages = Object.getOwnPropertyNames(this.metadata.dictionaries);
				return { languages: languages, count: languages.length }
			}
		},

		/**
		 * Given a certain language, says if a word is of that languages
		 *
		 * @actions
		 * @param {String} lang - The language code
		 * @param {String} word - The word to check
		 *
		 * @return {Object} response
		 */
		check: {
			rest: "GET /:lang/check/:word",
			params: {
				lang: "string",
				word: "string",
			},
			async handler(ctx) {
				let { lang, word } = ctx.params;
				// Throws an error if language not supported
				if (!this.metadata.dictionaries.hasOwnProperty(lang))
					throw new MoleculerClientError(`Language ${ lang } is not supported`, 404, "", [{ field: "lang", message: "is not supported" }])

				return this.checkWord(lang, word);
			}
		},

		/**
		 * Performs the same check for batch of words
		 *
		 * @actions
		 * @param {String} lang - The language code
		 * @param {Array} word - The words to check
		 *
		 * @return {Object} response
		 */
		checkMultiple: {
			rest: "POST /:lang/check/multiple",
			params: {
				lang: "string",
				words: "array"
			},
			async handler(ctx) {
				const { lang, words } = ctx.params;
				// Throws an error if language not supported
				if (!this.metadata.dictionaries.hasOwnProperty(lang))
					throw new MoleculerClientError(`Language ${ lang } is not supported`, 404, "", [{ field: "lang", message: "is not supported" }])

				let response = {};
				words.forEach(word => {
					response[word] = this.checkWord(lang, word).result;
				});

				return response;
			}
		},

		/**
		 * Given a certain language, says if the language exist
		 *
		 * @actions
		 * @param {String} lang - The language code
		 *
		 * @return {Object} response
		 */
		checkLanguage: {
			params: {
				lang: "string"
			},
			async handler(ctx) {
				const { lang } = ctx.params;
				return this.metadata.dictionaries.hasOwnProperty(lang);
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {
		// Asserts the language exists
		checkWord(language, word) {
			const found = new Boolean(this.metadata.dictionaries[language][word]);

			return { result: found };
		}
	},

	/**
	 * Service created lifecycle event handler
	 *
	 * I just iterate over languages dictionnary files
	 * and async load it into the service.
	 *
	 * Hopefully the memory would be ok
	 */
	created() {
		// Open dictionaries directory
		let directory = fs.opendirSync(this.settings.DICTIONARY_DIR);

		/**
		 * Iterate over each directory entry
		 * If we find a json file just read it and parse it before
		 * appending to our dictionnaries
		 */
		let dictionary;
		while (dictionary = directory.readSync()) {
			if (dictionary.isFile() && dictionary.name.endsWith(".json")) {
				const filename = dictionary.name.replace(".json", "");
				dictionary = fs.readFileSync(`${ directory.path }/${ dictionary.name }`);
				this.metadata.dictionaries[`${ filename }`] = JSON.parse(dictionary);
			}
		}
		directory.closeSync(); // Always close at the end
	},
};
