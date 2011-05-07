// exports
exports.QueryFilters = {};
var QueryFilters = exports.QueryFilters;

// imports
var Utils = require("./../../js-trees/src/utils").Utils;

QueryFilters.checkFilters = function(pattern, bindings, queryEnv, queryEngine, callback) {
    var filters = pattern.filter;
    if(filters && filters[0]) {
        QueryFilters.run(filters[0].value, bindings, queryEnv.outCache, queryEngine, callback);
    } else {
        callback(true, bindings);
    }
};

QueryFilters.boundVars = function(filterExpr) {
    if(filterExpr.expressionType != null) {
        var expressionType = filterExpr.expressionType;
        if(expressionType == 'relationalexpression') {
            var op1 = filterExpr.op1;
            var op2 = filterExpr.op2;
            return QueryFilters.boundVars(op1)+QueryFilters.boundVars(op2);
        } else if(expressionType == 'conditionalor' || expressionType == 'conditionaland') {
            var vars = [];
            for(var i=0; i< filterExpr.operands; i++) {
                vars = vars.concat(QueryFilters.boundVars(filterExpr.operands[i]));
            }
            return vars;
        } else if(expressionType == 'builtincall') {
            if(filterExpr.args == null) {
                return [];
            } else {
                var acum = [];
                for(var i=0; i< filterExpr.args.length; i++) {
                    acum = acum.concat(QueryFilters.boundVars(filterExpr.args[i]));
                }
                return acum;
            }
        } else if(expressionType == 'multiplicativeexpression') {
            var acum = QueryFilters.boundVars(filterExpr.factor);
            for(var i=0; i<filterExpr.factors.length; i++) {
                acum = acum.concat(QueryFilters.boundVars(filterExpr.factors[i].expression))
            }
            return acum;
        } else if(expressionType == 'additiveexpression') {
            var acum = QueryFilters.boundVars(filterExpr.summand);
            for(var i=0; i<filterExpr.summands.length; i++) {
                acum = acum.concat(QueryFilters.boundVars(filterExpr.summands[i].expression))
            }

            return acum;
        } else if(expressionType == 'regex') {
            var acum = QueryFilters.boundVars(filterExpr.expression1);
            return acum.concat(QueryFilters.boundVars(filterExpr.expression2));
        } else if(expressionType == 'unaryexpression') {
            return QueryFilters.boundVars(filterExpr.expression);
        } else if(expressionType == 'atomic') {           
            if(filterExpr.primaryexpression == 'var') {
                return [filterExpr.value];
            } else {
                // numeric, literal, etc...
                return [];
            }
        }
    } else {
        console.log("ERROR");
        console.log(filterExpr);
        throw("Cannot find bound expressions in a no expression token");
    }
};

QueryFilters.run = function(filterExpr, bindings, outCache, queryEngine, callback) {
    queryEngine.copyDenormalizedBindings(bindings, outCache, function(success, denormBindings){
        if(success === true) {
            var filteredBindings = [];
            for(var i=0; i<bindings.length; i++) {
                var thisDenormBindings = denormBindings[i];
                var ebv = QueryFilters.runFilter(filterExpr, thisDenormBindings);
                if(QueryFilters.ebv(ebv) === true) {
                    filteredBindings.push(bindings[i]);
                }
            }
            callback(true, filteredBindings);
        } else {
            callback(success, denormBindings);
        }
    });
};

QueryFilters.runFilter = function(filterExpr, bindings) {
    if(filterExpr.expressionType != null) {
        var expressionType = filterExpr.expressionType;
        if(expressionType == 'relationalexpression') {
            var op1 = QueryFilters.runFilter(filterExpr.op1, bindings);
            var op2 = QueryFilters.runFilter(filterExpr.op2, bindings);
            return QueryFilters.runRelationalFilter(filterExpr, op1, op2, bindings);
        } else if(expressionType == 'conditionalor') {
            return QueryFilters.runOrFunction(filterExpr, bindings);
        } else if (expressionType == 'conditionaland') {
            return QueryFilters.runAndFunction(filterExpr, bindings);
            

//        } else if(expressionType == 'builtincall') {
//            if(filterExpr.args == null) {
//                return [];
//            } else {
//                var acum = [];
//                for(var i=0; i< filterExpr.args.length; i++) {
//                    acum = acum.concat(QueryFilters.boundVars(filterExpr.args[i]));
//                }
//                return acum;
//            }
//        } else if(expressionType == 'multiplicativeexpression') {
//            var acum = QueryFilters.boundVars(filterExpr.factor);
//            for(var i=0; i<filterExpr.factors.length; i++) {
//                acum = acum.concat(QueryFilters.boundVars(filterExpr.factors[i].expression))
//            }
//            return acum;
//        } else if(expressionType == 'additiveexpression') {
//            var acum = QueryFilters.boundVars(filterExpr.summand);
//            for(var i=0; i<filterExpr.summands.length; i++) {
//                acum = acum.concat(QueryFilters.boundVars(filterExpr.summands[i].expression))
//            }
// 
//            return acum;
//        } else if(expressionType == 'regex') {
//            var acum = QueryFilters.boundVars(filterExpr.expression1);
//            return acum.concat(QueryFilters.boundVars(filterExpr.expression2));
//        } else if(expressionType == 'unaryexpression') {
//            return QueryFilters.boundVars(filterExpr.expression);
        } else if(expressionType == 'atomic') {           
            if(filterExpr.primaryexpression == 'var') {
                // lookup the var in the bindings
                var val = bindings[filterExpr.value.value];
                return val;
            } else {
                // numeric, literal, etc...
                return filterExpr.value;
            }
        } else {
            throw("Unknown filter expression type");
        }
    } else {
        throw("Cannot find bound expressions in a no expression token");
    }
};

QueryFilters.isNumeric = function(val) {
    if(val == null) {
        return false;
    }
    if(val.token === 'literal') {
        if(val.type == "http://www.w3.org/2001/XMLSchema#integer" ||
           val.type == "http://www.w3.org/2001/XMLSchema#decimal" ||
           val.type == "http://www.w3.org/2001/XMLSchema#float" ||
           val.type == "http://www.w3.org/2001/XMLSchema#double" ||
           val.type == "http://www.w3.org/2001/XMLSchema#nonPositiveInteger" ||
           val.type == "http://www.w3.org/2001/XMLSchema#negativeInteger" ||
           val.type == "http://www.w3.org/2001/XMLSchema#long" ||
           val.type == "http://www.w3.org/2001/XMLSchema#int" ||
           val.type == "http://www.w3.org/2001/XMLSchema#short" ||
           val.type == "http://www.w3.org/2001/XMLSchema#byte" ||
           val.type == "http://www.w3.org/2001/XMLSchema#nonNegativeInteger" ||
           val.type == "http://www.w3.org/2001/XMLSchema#unsignedLong" ||
           val.type == "http://www.w3.org/2001/XMLSchema#unsignedInt" ||
           val.type == "http://www.w3.org/2001/XMLSchema#unsignedShort" ||
           val.type == "http://www.w3.org/2001/XMLSchema#unsignedByte" ||
           val.type == "http://www.w3.org/2001/XMLSchema#positiveInteger" ) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
};

QueryFilters.isSimpleLiteral = function(val) {
    if(val && val.token == 'literal') {
        if(val.type == null && val.lang == null) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
};

QueryFilters.isXsdType = function(type, val) {
    if(val && val.token == 'literal') {
        return val.type == "http://www.w3.org/2001/XMLSchema#"+val;
    } else {
        return false;
    }
};

QueryFilters.ebv = function(term) {
    if(term == null) {
        return false;
    } else {
        return term.value === true;
    }
}


QueryFilters.ebvTrue = function() {
    val = {token: 'literal', type:"http://www.w3.org/2001/XMLSchema#boolean", value:true};
    return val;
};

QueryFilters.ebvFalse = function() {
    val = {token: 'literal', type:"http://www.w3.org/2001/XMLSchema#boolean", value:false};
    return val;
};

QueryFilters.ebvBoolean = function(bool) {
    if(bool === true) {
        return QueryFilters.ebvTrue();
    } else {
        return QueryFilters.ebvFalse();
    }
}


QueryFilters.runRelationalFilter = function(filterExpr, op1, op2, bindings) {
    var operator = filterExpr.operator;
    if(operator === '=') {
        return QueryFilters.runEqualityFunction(op1, op2, bindings);
    } else if(operator === '!=') {
       
    } else if(operator === '<') {
        return QueryFilters.runLtFunction(op1, op2, bindings);
    } else if(operator === '>') {
        return QueryFilters.runGtFunction(op1, op2, bindings);
    } else if(operator === '<=') {
        return QueryFilters.runLtEqFunction(op1, op2, bindings);
    } else if(operator === '>=') {
        return QueryFilters.runGtEqFunction(op1, op2, bindings);
    } else {
        throw("Error applying relational filter, unknown operator");
    }
};

/**
 * Transforms a JS object representing a [typed] literal in a javascript
 * value that can be used in javascript operations and functions
 */
QueryFilters.effectiveTypeValue = function(val){
    if(val.token == 'literal') {
        if(val.type == "http://www.w3.org/2001/XMLSchema#integer") {
            return parseInt(val.value);
        } else if(val.type == "http://www.w3.org/2001/XMLSchema#decimal") {
            return parseFloat(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#float") {
            return parseFloat(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#double") {
            return parseFloat(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#nonPositiveInteger") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#negativeInteger") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#long") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#int") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#short") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#byte") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#nonNegativeInteger") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#unsignedLong") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#unsignedInt") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#unsignedShort") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#unsignedByte") {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#positiveInteger" ) {
            return parseInt(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#dateTime" ) {
            return new Date(val.value);
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#boolean" ) {
            return val.value === true || val.value === 'true' || val.value === '1' || val.value === 1 || val.value === true ? true :
                val.value === false || val.value === 'false' || val.value === '0' || val.value === 0 || val.value === false ? false :
                undefined;
        } else if (val.type == "http://www.w3.org/2001/XMLSchema#string" ) {
            return val.value === null || val.value === undefined ? undefined : ''+val.value;
        } else if (val.type == null) {
            // plain literal -> just manipulate the string
            return val.value;
        } else {
            val.value
        }
    } else {
        // @todo
        console.log("not implemented yet");
        throw("value not supported in operations yet");
    }
};

QueryFilters.runOrFunction = function(filterExpr, bindings) {
    for(var i=0; i< filterExpr.operands.length; i++) {
        var ebv = QueryFilters.runFilter(filterExpr.operands[i], bindings);
        if(QueryFilters.ebv(ebv) === true) {
            return ebv;
        }
    }

    return QueryFilters.ebvBoolean(false);
};

QueryFilters.runAndFunction = function(filterExpr, bindings) {
    for(var i=0; i< filterExpr.operands.length; i++) {
        var ebv = QueryFilters.runFilter(filterExpr.operands[i], bindings);
        if(QueryFilters.ebv(ebv) === false) {
            return ebv;
        }
    }

    return QueryFilters.ebvBoolean(true);
};

QueryFilters.runEqualityFunction = function(op1, op2, bindings) {
    if(QueryFilters.isNumeric(op1) && QueryFilters.isNumeric(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) == QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isSimpleLiteral(op1) && QueryFilters.isSimpleLiteral(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) == QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("string", op1) && QueryFilters.isXsdType("string", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) == QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("boolean", op1) && QueryFilters.isXsdType("boolean", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) == QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isXsdType("dateTime", op1) && QueryFilters.isXsdType("dateTime", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1).getTime() == QueryFilters.effectiveTypeValue(op2).getTime());
    } else {
        return QueryFilters.ebvFalse();
    }
};

QueryFilters.runGtFunction = function(op1, op2, bindings) {
    if(QueryFilters.isNumeric(op1) && QueryFilters.isNumeric(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) > QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isSimpleLiteral(op1) && QueryFilters.isSimpleLiteral(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) > QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("string", op1) && QueryFilters.isXsdType("string", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) > QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("boolean", op1) && QueryFilters.isXsdType("boolean", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) > QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isXsdType("dateTime", op1) && QueryFilters.isXsdType("dateTime", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1).getTime() > QueryFilters.effectiveTypeValue(op2).getTime());
    } else {
        return QueryFilters.ebvFalse();
    }
};


QueryFilters.runLtFunction = function(op1, op2, bindings) {
    if(QueryFilters.isNumeric(op1) && QueryFilters.isNumeric(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) < QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isSimpleLiteral(op1) && QueryFilters.isSimpleLiteral(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) < QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("string", op1) && QueryFilters.isXsdType("string", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) < QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("boolean", op1) && QueryFilters.isXsdType("boolean", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) < QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isXsdType("dateTime", op1) && QueryFilters.isXsdType("dateTime", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1).getTime() < QueryFilters.effectiveTypeValue(op2).getTime());
    } else {
        return QueryFilters.ebvFalse();
    }
};


QueryFilters.runGtEqFunction = function(op1, op2, bindings) {
    if(QueryFilters.isNumeric(op1) && QueryFilters.isNumeric(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) >= QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isSimpleLiteral(op1) && QueryFilters.isSimpleLiteral(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) >= QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("string", op1) && QueryFilters.isXsdType("string", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) >= QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("boolean", op1) && QueryFilters.isXsdType("boolean", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) >= QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isXsdType("dateTime", op1) && QueryFilters.isXsdType("dateTime", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1).getTime() >= QueryFilters.effectiveTypeValue(op2).getTime());
    } else {
        return QueryFilters.ebvFalse();
    }
};


QueryFilters.runLtEqFunction = function(op1, op2, bindings) {
    if(QueryFilters.isNumeric(op1) && QueryFilters.isNumeric(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) <= QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isSimpleLiteral(op1) && QueryFilters.isSimpleLiteral(op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) <= QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("string", op1) && QueryFilters.isXsdType("string", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) <= QueryFilters.effectiveTypeValue(op2));       
    } else if(QueryFilters.isXsdType("boolean", op1) && QueryFilters.isXsdType("boolean", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1) <= QueryFilters.effectiveTypeValue(op2));
    } else if(QueryFilters.isXsdType("dateTime", op1) && QueryFilters.isXsdType("dateTime", op2)) {
        return QueryFilters.ebvBoolean(QueryFilters.effectiveTypeValue(op1).getTime() <= QueryFilters.effectiveTypeValue(op2).getTime());
    } else {
        return QueryFilters.ebvFalse();
    }
};

