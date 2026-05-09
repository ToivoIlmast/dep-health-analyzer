console.log('it is no-imports-and-exports file');

const fun1 = () => {
    return 1 + 2;
};

function fun2() {
    return 3 + 4;
}

const result1 = fun1();
console.log('result1', result1);

const result2 = fun2();
console.log('result2', result2);
