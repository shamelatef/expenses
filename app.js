document.addEventListener('DOMContentLoaded', function() {
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    
    let db;
    const DB_NAME = 'ExpenseTrackerDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'expenses';
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('monthYear', 'monthYear', { unique: false });
            store.createIndex('category', 'category', { unique: false });
        }
    };
    
    request.onsuccess = function(event) {
        db = event.target.result;
        updateMonthDisplay();
        loadExpensesForMonth();
    };
    
    request.onerror = function(event) {
        console.error('IndexedDB error:', event.target.error);
    };
    
    document.getElementById('add-expense-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const amount = parseFloat(document.getElementById('amount').value);
        const description = document.getElementById('description').value.trim();
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;
        
        if (!amount || !description || !category || !date) {
            alert('Please fill all fields');
            return;
        }
        
        const expenseDate = new Date(date);
        const monthYear = `${expenseDate.getFullYear()}-${expenseDate.getMonth()}`;
        
        const expense = {
            amount,
            description,
            category,
            date,
            monthYear,
            createdAt: new Date().toISOString()
        };
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.add(expense);
        
        request.onsuccess = function() {
            document.getElementById('add-expense-form').reset();
            
            if (monthYear === `${currentYear}-${currentMonth}`) {
                loadExpensesForMonth();
            }
        };
        
        request.onerror = function(event) {
            console.error('Error adding expense:', event.target.error);
        };
    });
    
    document.getElementById('prev-month').addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        updateMonthDisplay();
        loadExpensesForMonth();
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        updateMonthDisplay();
        loadExpensesForMonth();
    });
    
    document.getElementById('generate-report').addEventListener('click', generateMonthlyReport);
    
    function updateMonthDisplay() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[currentMonth];
        
        document.getElementById('current-month').textContent = `${monthName} ${currentYear}`;
        document.getElementById('list-month').textContent = `${monthName} ${currentYear}`;
    }
    
    function loadExpensesForMonth() {
        const monthYear = `${currentYear}-${currentMonth}`;
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('monthYear');
        const request = index.getAll(monthYear);
        
        request.onsuccess = function() {
            const expenses = request.result;
            displayExpenses(expenses);
            updateTotal(expenses);
        };
        
        request.onerror = function(event) {
            console.error('Error loading expenses:', event.target.error);
        };
    }
    
    function displayExpenses(expenses) {
        const container = document.getElementById('expenses-container');
        container.innerHTML = '';
        
        if (expenses.length === 0) {
            container.innerHTML = '<li class="no-expenses">No expenses recorded for this month.</li>';
            return;
        }
        
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        expenses.forEach(expense => {
            const li = document.createElement('li');
            li.className = 'expense-item';
            li.dataset.id = expense.id;
            
            li.innerHTML = `
                <div class="expense-details">
                    <div class="expense-description">${expense.description}</div>
                    <div>
                        <span class="expense-category">${expense.category}</span>
                        <span class="expense-date">${formatDate(expense.date)}</span>
                    </div>
                </div>
                <div class="expense-amount">$${expense.amount.toFixed(2)}</div>
                <button class="delete-btn" data-id="${expense.id}">Delete</button>
            `;
            
            container.appendChild(li);
        });
        
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                deleteExpense(id);
            });
        });
    }
    
    function deleteExpense(id) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.delete(id);
        
        request.onsuccess = function() {
            loadExpensesForMonth();
        };
        
        request.onerror = function(event) {
            console.error('Error deleting expense:', event.target.error);
        };
    }
    
    function updateTotal(expenses) {
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('month-total').textContent = total.toFixed(2);
    }
    
    function generateMonthlyReport() {
        const monthYear = `${currentYear}-${currentMonth}`;
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('monthYear');
        const request = index.getAll(monthYear);
        
        request.onsuccess = function() {
            const expenses = request.result;
            if (expenses.length === 0) {
                document.getElementById('report-container').innerHTML = '<p>No expenses to generate report.</p>';
                document.getElementById('category-breakdown').innerHTML = '';
                return;
            }
            
            const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            
            const categories = {};
            expenses.forEach(expense => {
                if (!categories[expense.category]) {
                    categories[expense.category] = 0;
                }
                categories[expense.category] += expense.amount;
            });
            
            const labels = Object.keys(categories);
            const data = labels.map(cat => categories[cat]);
            const backgroundColors = [
                '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', 
                '#59a14f', '#edc948', '#b07aa1', '#ff9da7'
            ].slice(0, labels.length);
            
            const canvas = document.createElement('canvas');
            document.getElementById('report-container').innerHTML = '';
            document.getElementById('report-container').appendChild(canvas);
            
            new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Expense Distribution by Category',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.raw;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: $${value.toFixed(2)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            
            const breakdownContainer = document.getElementById('category-breakdown');
            breakdownContainer.innerHTML = '<h4>Category Breakdown</h4>';
            
            const sortedCategories = Object.entries(categories)
                .sort((a, b) => b[1] - a[1]);
            
            sortedCategories.forEach(([category, amount]) => {
                const percentage = ((amount / total) * 100).toFixed(1);
                const item = document.createElement('div');
                item.className = 'category-item';
                item.innerHTML = `
                    <span>${category}</span>
                    <span>
                        $${amount.toFixed(2)} 
                        <span class="category-percentage">(${percentage}%)</span>
                    </span>
                `;
                breakdownContainer.appendChild(item);
            });
        };
    }
    
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('service-worker.js').then(
                function(registration) {
                    console.log('ServiceWorker registration successful');
                }, 
                function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                }
            );
        });
    }
});
