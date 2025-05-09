// This file contains test cases for JWT signing validation
export const jwtSigningTestCases = [
  {
    description: "ES256K - Valid Signature",
    tokenString:
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJiYXIifQ.uq2X8CtBrg-fPvkJ5Dl-AHWQ1HPVnZfA1o0azRlHEBkE7YzOdr44UWmlkavjrl3lMHr4jhROugXi8cjrrZ2Kzw",
    expected: {
      alg: "ES256K",
      claims: {
        issuer: "bar"
      }
    },
    mustFail: false
  },
  {
    description: "ES256K - Invalid Signature",
    tokenString:
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpc3MiOiJiYXIifQ.MEQCIHoSJnmGlPaVQDqacx_2XlXEhhqtWceVopjomc2PJLtdAiAUTeGPoNYxZw0z8mgOnnIcjoxRuNDVZvybRZF3wR1l8W",
    expected: {
      alg: "ES256K",
      claims: {
        issuer: "bar"
      }
    },
    claims: {
      issuer: "bar"
    },
    mustFail: true
  }
];
