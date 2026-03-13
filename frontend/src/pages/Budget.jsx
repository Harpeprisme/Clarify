import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

const Budget = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [loading, setLoading] = useState(true);
  
  const { getFilterParams, filterPreset, filterDateFrom, filterDateTo, filterAccountIds, filterAccountType, accounts } = useStore();

  useEffect(() => {
    fetchData();
  }, [filterPreset, filterDateFrom, filterDateTo, filterAccountIds, filterAccountType]);

  const monthsRatio = useMemo(() => {
    try {
      const start = filterDateFrom ? new Date(filterDateFrom) : (accounts.length > 0 ? new Date(accounts[0].createdAt) : new Date());
      const end = filterDateTo ? new Date(filterDateTo) : new Date();
      const days = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
      return days / 30.44; // Avg days per month
    } catch { return 1; }
  }, [filterDateFrom, filterDateTo, accounts]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, bufRes] = await Promise.all([
        api.get('/categories'),
        api.get('/budgets')
      ]);
      setCategories(catRes.data);
      setBudgets(bufRes.data);

      const query = getFilterParams().toString();
      const transRes = await api.get(`/transactions?${query}&limit=5000`);
      
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
        amount: parseFloat(amount) || 0
      });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const getBudgetItem = (categoryId) => budgets.find(b => b.categoryId === categoryId);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="title" style={{ marginBottom: 0 }}>Suivi Budgétaire</h1>
      </div>
      
      <Card>
        {loading ? (
          <div className="text-center p-8 text-muted">Chargement des données...</div>
        ) : (
          <div className="flex-col gap-4">
            {categories.map(category => {
              const budgetObj = getBudgetItem(category.id);
              const monthlyGoal = budgetObj ? budgetObj.amount : 0;
              const globalGoal = monthlyGoal * monthsRatio;
              
              const currentExpense = expenses[category.id] || 0;
              
              if (monthlyGoal === 0 && currentExpense === 0) return null;

              const percent = globalGoal > 0 ? (currentExpense / globalGoal) * 100 : 0;
              const isOverBudget = currentExpense > globalGoal && globalGoal > 0;
              const progressColor = isOverBudget ? 'var(--danger)' : percent > 80 ? 'var(--warning)' : 'var(--success)';

              return (
                <div key={category.id} style={{ padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: category.color }}></div>
                      <span 
                        className="font-semibold text-lg" 
                        style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseOver={(e) => e.target.style.color = 'var(--accent-primary)'}
                        onMouseOut={(e) => e.target.style.color = 'inherit'}
                        onClick={() => navigate(`/transactions?categoryId=${category.id}`)}
                        title="Voir les transactions de cette catégorie"
                      >
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {isOverBudget && (
                        <span className="badge badge-danger">
                          Dépassement: {formatCurrency(currentExpense - globalGoal)}
                        </span>
                      )}
                      <div className="text-right">
                        <span className="font-bold text-xl">{formatCurrency(currentExpense)}</span>
                        <span className="text-muted text-sm" style={{ margin: '0 0.5rem' }}>/ {formatCurrency(globalGoal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Goal editing */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <span className="text-muted">Objectif mensuel de base :</span>
                    <input 
                      type="number"
                      className="input"
                      style={{ width: '100px', padding: '0.3rem', fontSize: '0.85rem', textAlign: 'right' }}
                      defaultValue={monthlyGoal || ''}
                      placeholder="Budget"
                      onBlur={(e) => {
                        if (e.target.value !== monthlyGoal.toString()) {
                          handleUpdateBudget(category.id, e.target.value);
                        }
                      }}
                    />
                  </div>

                  {/* Progress Bar */}
                  {globalGoal > 0 && (
                    <div style={{ position: 'relative', width: '100%', height: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', overflow: 'hidden' }}>
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
