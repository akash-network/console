const { CompoundCondition, FieldCondition } = require("@ucast/core");
const { interpret } = require('@ucast/js')

const ast = {
  "operator": "and",
  "value": [
    { "field": "value.id.owner", "operator": "eq", "value": "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd" },
    { "field": "type", "operator": "eq", "value": "akash.deployment.v1beta3.MsgCloseDeployment" }
  ]
};

function toConditions(ast) {
  if (['and', 'or'].includes(ast.operator)) {
    return new CompoundCondition(
      ast.operator,
      ast.value.map(toConditions),
    );
  }

  return new FieldCondition(ast.operator, ast.field, ast.value);
}

const res = interpret(toConditions(ast), {
  type: 'akash.deployment.v1beta3.MsgCloseDeployment',
  value: {
    id: {
      dseq: {
        low: 21021592
      },
      owner: 'akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd'
    },
    '$type': 'akash.deployment.v1beta3.MsgCloseDeployment'
  }
})

console.log('DEBUG res', res)
