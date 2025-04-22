// This file contains test cases for JWT validation
export const jwtTestCases = [
  {
    description: "ES256K - Valid Signature",
    tokenString:
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJmb28iOiJiYXIifQ.oN4T_XM-RlqC56wSoz9avJxZbWtern-2wUwIcytBo_gUQdqmudiOSUs4DfM6yzEcFth9OsZCXyXH0iQHvJzI6A",
    expected: {
      alg: "ES256K",
      claims: {
        foo: "bar"
      }
    },
    mustFail: false
  },
  {
    description: "ES256K - Invalid Signature",
    tokenString:
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJmb28iOiJiYXIifQ.MEQCIHoSJnmGlPaVQDqacx_2XlXEhhqtWceVopjomc2PJLtdAiAUTeGPoNYxZw0z8mgOnnIcjoxRuNDVZvybRZF3wR1l8W",
    expected: {
      alg: "ES256K",
      claims: {
        foo: "bar"
      }
    },
    claims: {
      foo: "bar"
    },
    mustFail: true
  }
];
