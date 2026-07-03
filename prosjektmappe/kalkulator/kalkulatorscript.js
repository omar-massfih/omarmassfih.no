class Calculator {
    constructor(prevOperandElement, curOperandElement) {
        this.prevOperandElement = prevOperandElement;
        this.curOperandElement = curOperandElement;
        this.clear();
        this.setupEventListeners();
    }

    clear() {
        this.curOperand = '';
        this.prevOperand = '';
        this.operation = undefined;
    }

    delete() {
        this.curOperand = this.curOperand.slice(0, -1);
    }

    appendNumber(number) {
        if (number === ',' && this.curOperand.includes(',')) return;
        if (number === ',') {
            number = '.';
        }
        this.curOperand += number.toString();
    }

    chooseOperation(operation) {
        if (this.curOperand === '') return;
        if (this.prevOperand !== '') {
            this.compute();
        }
        this.operation = operation;
        this.prevOperand = this.curOperand;
        this.curOperand = '';
    }

    compute() {
        let result;
        const prev = parseFloat(this.prevOperand.replace(',', '.'));
        const current = parseFloat(this.curOperand.replace(',', '.'));
        if (isNaN(prev) || isNaN(current)) return;
        switch (this.operation) {
            case '+':
                result = prev + current;
                break;
            case '-':
                result = prev - current;
                break;
            case '*':
                result = prev * current;
                break;
            case '/':
                if (current === 0) {
                    result = 'Error';
                } else {
                    result = prev / current;
                }
                break;
            default:
                return;
        }
        this.curOperand = result.toString();
        this.operation = undefined;
        this.prevOperand = '';
    }

    updateDisplay() {
        this.curOperandElement.innerText = this.curOperand;
        if (this.operation != null) {
            this.prevOperandElement.innerText = `${this.prevOperand} ${this.operation}`;
        } else {
            this.prevOperandElement.innerText = '';
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.handleKeydown(event));
        const numberButtons = document.querySelectorAll('.number');
        const operationButtons = document.querySelectorAll('.operation');
        const equalsButton = document.querySelector('.equals');
        const deleteButton = document.querySelector('.delete');
        const clearButton = document.querySelector('.clear');

        numberButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.appendNumber(button.innerText);
                this.updateDisplay();
            });
        });

        operationButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.chooseOperation(button.innerText);
                this.updateDisplay();
            });
        });

        equalsButton.addEventListener('click', () => {
            this.compute();
            this.updateDisplay();
        });

        clearButton.addEventListener('click', () => {
            this.clear();
            this.updateDisplay();
        });

        deleteButton.addEventListener('click', () => {
            this.delete();
            this.updateDisplay();
        });
    }

    handleKeydown(event) {
        const key = event.key;
        const isNumber = !isNaN(parseFloat(key)) && isFinite(key);
        const operators = ['+', '-', '*', '/'];
        const isOperator = operators.includes(key);

        if (isNumber || key === ',') {
            event.preventDefault();
            this.appendNumber(key);
            this.updateDisplay();
        } else if (isOperator) {
            event.preventDefault();
            this.chooseOperation(key);
            this.updateDisplay();
        } else if (key === 'Enter' || key === '=') {
            event.preventDefault();
            this.compute();
            this.updateDisplay();
        } else if (key === 'Backspace') {
            event.preventDefault();
            this.delete();
            this.updateDisplay();
        } else if (key === 'Delete') {
            event.preventDefault();
            this.clear();
            this.updateDisplay();
        }
    }
}

const prevOperandElement = document.querySelector('.prev-operand');
const curOperandElement = document.querySelector('.cur-operand');
const calculator = new Calculator(prevOperandElement, curOperandElement);
