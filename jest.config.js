module.exports = {
  roots: ["<rootDir>/test"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testEnvironment: "jsdom",
  testRegex: "(.*|(\\.|/)(test|spec))\\.ts?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: [
    "fixtures", "components"
  ]
}
