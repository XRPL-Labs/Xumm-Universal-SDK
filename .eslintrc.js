module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint",
        "@typescript-eslint/tslint"
    ],
    "rules": {
        "@typescript-eslint/indent": [
            "error",
            2
        ],
        "@typescript-eslint/member-delimiter-style": [
            "error",
            {
                "multiline": {
                    "delimiter": "none",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/naming-convention": "off",
        "@typescript-eslint/no-empty-function": "error",
        "@typescript-eslint/no-shadow": [
            "error",
            {
                "hoist": "all"
            }
        ],
        "@typescript-eslint/no-unused-expressions": "error",
        "@typescript-eslint/quotes": [
            "error",
            "single"
        ],
        "@typescript-eslint/semi": [
            "error",
            "never"
        ],
        "comma-dangle": "error",
        "complexity": [
            "off",
            {
                "max": 11
            }
        ],
        "curly": "error",
        "default-case": "off",
        "eol-last": "error",
        "eqeqeq": [
            "error",
            "always"
        ],
        "guard-for-in": "off",
        "id-blacklist": "off",
        "id-match": "off",
        "indent": "error",
        "linebreak-style": [
            "error",
            "unix"
        ],
        "new-parens": "error",
        "no-caller": "error",
        "no-cond-assign": "error",
        "no-console": "off",
        "no-constant-condition": "error",
        "no-control-regex": "error",
        "no-debugger": "error",
        "no-empty": "error",
        "no-empty-function": "error",
        "no-eval": "error",
        "no-fallthrough": "error",
        "no-invalid-regexp": "error",
        "no-invalid-this": "off",
        "no-irregular-whitespace": "error",
        "no-magic-numbers": "off",
        "no-multiple-empty-lines": [
            "error",
            {
                "max": 2
            }
        ],
        "no-new-wrappers": "error",
        "no-redeclare": "error",
        "no-regex-spaces": "error",
        "no-shadow": "error",
        "no-throw-literal": "error",
        "no-trailing-spaces": "error",
        "no-underscore-dangle": "off",
        "no-unused-expressions": "error",
        "no-unused-labels": "error",
        "no-var": "error",
        "object-shorthand": "off",
        "one-var": [
            "error",
            "never"
        ],
        "prefer-const": "error",
        "quote-props": "off",
        "quotes": "error",
        "radix": "error",
        "semi": "error",
        "spaced-comment": [
            "error",
            "always",
            {
                "markers": [
                    "/"
                ]
            }
        ],
        "use-isnan": "error",
        "@typescript-eslint/tslint/config": [
            "error",
            {
                "rules": {
                    "array-bracket-spacing": [
                        true,
                        "never"
                    ],
                    "ban": [
                        true,
                        [
                            "alert"
                        ]
                    ],
                    "block-spacing": true,
                    "brace-style": [
                        true,
                        "1tbs",
                        {
                            "allowSingleLine": true
                        }
                    ],
                    "handle-callback-err": true,
                    "no-duplicate-case": true,
                    "no-empty-character-class": true,
                    "no-ex-assign": true,
                    "no-extra-boolean-cast": true,
                    "no-extra-semi": true,
                    "no-inner-declarations": [
                        true,
                        "functions"
                    ],
                    "no-multi-spaces": true,
                    "no-unexpected-multiline": true,
                    "object-curly-spacing": [
                        true,
                        "never"
                    ],
                    "space-in-parens": [
                        true,
                        "never"
                    ],
                    "ter-arrow-parens": [
                        true,
                        "as-needed"
                    ],
                    "ter-arrow-spacing": true,
                    "ter-max-len": [
                        true,
                        120
                    ],
                    "ter-no-irregular-whitespace": true,
                    "ter-no-sparse-arrays": true,
                    "valid-typeof": true
                }
            }
        ]
    }
};
