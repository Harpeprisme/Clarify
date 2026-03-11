import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../api';
import Card from '../components/Card';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

const Budget = () => {
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Selected month state
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    fetchData();
  }, [month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch categories
      const catRes = await api.get('/categories');
      setCategories(catRes.data);

      // 2. Fetch budgets for the month
      const bufRes = await api.get(`/budgets?month=${month}`);
      setBudgets(bufRes.data);

      // 3. Fetch expenses for the month to compare with budget
      // Construct exact start and end of that month
      const startD = new Date(`${month}-01T00:00:00`);
      const endD = new Date(startD.getFullYear(), startD.getMonth() + 1, 0, 23, 59, 59);
      
      const expRes = await api.get(`/charts/expenses-by-category?startDate=${startD.toISOString()}&endDate=${endD.toISOString()}`);
      
      // Transform expenses array to an object indexed by categoryId
      const expDict = {};
      expRes.data.forEach(item => {
        // charts logic maps it by name, but we need categoryId.
        // Let's refetch or map it. Actually the charts route returned {name, color, value}
        // Let's do a quick custom fetch from transactions to guarantee ID mapping
        // Quickest way for MVP is to fetch all transactions matching the date and type EXPENSE
      });

      const transRes = await api.get(`/transactions?startDate=${startD.toISOString()}&endDate=${endD.toISOString()}&limit=1000`);
      
      const calcExp = {};
      transRes.data.data.forEach(t => {
        if (t.type === 'EXPENSE' && !t.isInternal && t.categoryId) {
          calcExp[t.categoryId] = (calcExp[t.categoryId] || 0) + Math.abs(t.amount);
        }
      });
      setExpenses(calcExp);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBudget = async (categoryId, amount) => {
    try {
      await api.post('/budgets', {
        categoryId,
        amount: parseFloat(amount) || 0,
        month
      });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const getBudgetItem = (categoryId) => budgets.find(b => b.categoryId === categoryId);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="title" style={{ marginBottom: 0 }}>Suivi Budgétaire</h1>
        <input 
          type="month" 
          className="input" 
          style={{ width: 'auto' }}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <div className="text-center p-8 text-muted">Chargement des données...</div>
        ) : (
          <div className="flex-col gap-4">
            {categories.map(category => {
              const budgetObj = getBudgetItem(category.id);
              const budgetLimit = budgetObj ? budgetObj.amount : 0;
              const currentExpense = expenses[category.id] || 0;
              
              // If no budget is set AND no expenses, don't show by default to save space
              if (budgetLimit === 0 && currentExpense === 0) return null;

              const percent = budgetLimit > 0 ? (currentExpense / budgetLimit) * 100 : 0;
              const isOverBudget = currentExpense > budgetLimit && budgetLimit > 0;
              const progressColor = isOverBudget ? 'var(--danger)' : percent > 80 ? 'var(--warning)' : 'var(--success)';

              return (
                <div key={category.id} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: category.color }}></div>
                      <span className="font-semibold">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {isOverBudget && (
                        <span className="badge badge-danger">
                          Dépassement de {formatCurrency(currentExpense - budgetLimit)}
                        </span>
                      )}
                      <div className="text-right">
                        <span className="font-bold">{formatCurrency(currentExpense)}</span>
                        <span className="text-muted" style={{ margin: '0 0.5rem' }}>/</span>
                        <input 
                          type="number"
                          className="input"
                          style={{ width: '100px', padding: '0.3rem', fontSize: '0.9rem', textAlign: 'right' }}
                          defaultValue={budgetLimit || ''}
                          placeholder="Budget"
                          onBlur={(e) => {
                            if (e.target.value !== budgetLimit.toString()) {
                              handleUpdateBudget(category.id, e.target.value);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {budgetLimit > 0 && (
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min(percent, 100)}%`, 
                        backgroundColor: progressColor,
                        transition: 'width 0.3s ease, background-color 0.3s ease'
                      }}></div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Form to add budget to empty categories */}
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <h4 className="font-semibold mb-4 text-muted">Ajouter un budget à une nouvelle catégorie</h4>
              <div className="flex gap-4 items-center">
                <select id="newBudgetCat" className="input" style={{ flex: 1 }}>
                  <option value="">Sélectionner une catégorie...</option>
                  {categories.filter(c => !getBudgetItem(c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input id="newBudgetAmt" type="number" className="input" placeholder="Montant (ex: 200)" style={{ width: '150px' }} />
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    const catId = document.getElementById('newBudgetCat').value;
                    const amt = document.getElementById('newBudgetAmt').value;
                    if (catId && amt) {
                      handleUpdateBudget(catId, amt);
                      document.getElementById('newBudgetAmt').value = '';
                    }
                  }}
                >
                  Ajouter
                </button>
              </div>
            </div>

          </div>
        )}
      </Card>
    </div>
  );
};

export default Budget;
