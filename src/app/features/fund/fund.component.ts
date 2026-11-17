import { Component, OnInit, inject, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CanEditDirective } from '../../shared/can-edit.directive';
import { DisableUnlessCanEditDirective } from '../../shared/disable-unless-can-edit.directive';
import { FirebaseService, HistoryEntry } from '../../services/firebase.service';
import { PermissionService } from '../../core/services/permission.service';
import { Subscription } from 'rxjs';
import {
  FUND_CURRENCY,
  FUND_DATE_FORMAT,
  FUND_CATEGORIES
} from './fund.constants';
import { FundTransactionService, Transaction as FundTransaction } from './fund-transaction.service';
import { LoggerService } from '../../core/services/logger.service';

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  relatedTo?: string;
}

interface FundSummary {
  currentBalance: number;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  matchTotalIncome: number;
  matchTotalExpenses: number;
  grandTotalIncome: number;
  grandTotalExpenses: number;
  monthlyProfit: number;
}

@Component({
  selector: 'app-fund',
  standalone: true,
  imports: [FormsModule, CanEditDirective, DisableUnlessCanEditDirective],
  template: `
    <div class="fund-dashboard">
      <!-- Modern Header -->
      <div class="dashboard-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="dashboard-title">
              <span class="title-icon">💰</span>
              Quản lý Quỹ Đội Bóng
            </h1>
            <p class="dashboard-subtitle">Theo dõi tài chính và quản lý thu chi hiệu quả</p>
          </div>
          <div class="header-actions" *appCanEdit; else readOnlyBanner>
            <button class="btn-primary" (click)="showAddTransaction = true">
              <span class="btn-icon">➕</span>
              Thêm giao dịch
            </button>
          </div>
          <ng-template #readOnlyBanner>
            <div class="readonly-note">Chế độ xem (đăng nhập để thêm giao dịch)</div>
          </ng-template>
        </div>
      </div>
    
      <!-- Summary Cards Grid -->
      <div class="summary-grid">
        <div class="summary-card balance-card" [class.negative]="fundSummary.currentBalance < 0">
          <div class="card-header">
            <span class="card-icon balance-icon">💳</span>
            <span class="card-title">Số dư hiện tại</span>
          </div>
          <div class="card-content">
            <div class="main-value">{{formatCurrency(fundSummary.currentBalance)}}</div>
            <div class="card-subtitle" [class.positive]="fundSummary.monthlyProfit > 0" [class.negative]="fundSummary.monthlyProfit < 0">
              <span class="trend-icon">{{fundSummary.monthlyProfit > 0 ? '📈' : '📉'}}</span>
              {{formatCurrency(fundSummary.monthlyProfit)}} tháng này
            </div>
          </div>
        </div>
    
        <div class="summary-card income-card">
          <div class="card-header">
            <span class="card-icon income-icon">📈</span>
            <span class="card-title">Tổng thu</span>
          </div>
          <div class="card-content">
            <div class="main-value income">{{formatCurrency(fundSummary.grandTotalIncome)}}</div>
            <div class="card-subtitle">
              <div class="breakdown">
                <span>Trận đấu: {{formatCurrency(fundSummary.matchTotalIncome)}}</span>
                <span>Giao dịch: {{formatCurrency(fundSummary.totalIncome)}}</span>
              </div>
            </div>
          </div>
        </div>
    
        <div class="summary-card expense-card">
          <div class="card-header">
            <span class="card-icon expense-icon">📉</span>
            <span class="card-title">Tổng chi</span>
          </div>
          <div class="card-content">
            <div class="main-value expense">{{formatCurrency(fundSummary.grandTotalExpenses)}}</div>
            <div class="card-subtitle">
              <div class="breakdown">
                <span>Trận đấu: {{formatCurrency(fundSummary.matchTotalExpenses)}}</span>
                <span>Giao dịch: {{formatCurrency(fundSummary.totalExpenses)}}</span>
              </div>
            </div>
          </div>
        </div>
    
        <div class="summary-card activity-card">
          <div class="card-header">
            <span class="card-icon activity-icon">📊</span>
            <span class="card-title">Hoạt động</span>
          </div>
          <div class="card-content">
            <div class="main-value activity">{{fundSummary.transactionCount}}</div>
            <div class="card-subtitle">Giao dịch trong tháng</div>
          </div>
        </div>
      </div>
    
      <!-- Quick Actions -->
      <div class="quick-actions-section">
        <h2 class="section-title">
          <span class="section-icon">⚡</span>
          Thao tác nhanh
        </h2>
        <div class="quick-actions-grid">
          <button class="quick-action-btn income-action" (click)="quickAddIncome()" appDisableUnlessCanEdit>
            <span class="action-icon">💰</span>
            <span class="action-text">Thêm thu nhập</span>
          </button>
          <button class="quick-action-btn expense-action" (click)="quickAddExpense()" appDisableUnlessCanEdit>
            <span class="action-icon">💸</span>
            <span class="action-text">Thêm chi phí</span>
          </button>
          <button class="quick-action-btn report-action" (click)="generateReport()">
            <span class="action-icon">📋</span>
            <span class="action-text">Báo cáo</span>
          </button>
          <button class="quick-action-btn sync-action" (click)="syncWithMatches()" appDisableUnlessCanEdit>
            <span class="action-icon">🔄</span>
            <span class="action-text">Đồng bộ trận đấu</span>
          </button>
        </div>
      </div>
    
      <!-- Transaction Management -->
      <div class="transaction-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-icon">📝</span>
            Lịch sử giao dịch
          </h2>
          <div class="section-actions">
            <div class="filter-group">
              <select [(ngModel)]="selectedFilter" (change)="filterTransactions()" class="filter-select">
                <option value="all">Tất cả</option>
                <option value="income">Thu nhập</option>
                <option value="expense">Chi phí</option>
                <option value="this-month">Tháng này</option>
              </select>
            </div>
            <button class="btn-secondary" (click)="exportTransactions()">
              <span class="btn-icon">📁</span>
              Xuất Excel
            </button>
          </div>
        </div>
    
        @if (filteredTransactions.length > 0) {
          <div class="transaction-list">
            @for (transaction of filteredTransactions; track trackTransaction($index, transaction)) {
              <div
                class="transaction-item"
                [class.income]="transaction.type === 'income'"
                [class.expense]="transaction.type === 'expense'">
                <div class="transaction-main">
                  <div class="transaction-info">
                    <div class="transaction-header">
                      <span class="transaction-category">{{transaction.category}}</span>
                      <span class="transaction-date">{{formatDate(transaction.date)}}</span>
                    </div>
                    <div class="transaction-description">{{transaction.description}}</div>
                  </div>
                  <div class="transaction-amount" [class.income]="transaction.type === 'income'" [class.expense]="transaction.type === 'expense'">
                    <span class="amount-symbol">{{transaction.type === 'income' ? '+' : '-'}}</span>
                    <span class="amount-value">{{formatCurrency(transaction.amount)}}</span>
                  </div>
                </div>
                <div class="transaction-actions">
                  <button class="action-btn edit" *appCanEdit (click)="editTransaction(transaction)" title="Chỉnh sửa">
                    ✏️
                  </button>
                  <button class="action-btn delete" *appCanEdit (click)="deleteTransaction(transaction)" title="Xóa">
                    🗑️
                  </button>
                </div>
              </div>
            }
          </div>
        }
    
        @if (filteredTransactions.length === 0) {
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <h3 class="empty-title">Chưa có giao dịch nào</h3>
            <p class="empty-text">Bắt đầu bằng cách thêm giao dịch đầu tiên của bạn</p>
            <button class="btn-primary" *appCanEdit (click)="showAddTransaction = true">
              <span class="btn-icon">➕</span>
              Thêm giao dịch đầu tiên
            </button>
          </div>
        }
      </div>
    
      <!-- Add Transaction Modal -->
      <ng-container *appCanEdit>
        @if (showAddTransaction) {
          <div class="modal-overlay" tabindex="0" (click)="showAddTransaction = false" (keyup.escape)="showAddTransaction = false">
            <div class="modal-content" tabindex="0" (click)="$event.stopPropagation()" (keyup.escape)="closeTransactionModal()">
              <div class="modal-header">
                <h3 class="modal-title">
                  <span class="modal-icon">💰</span>
                  {{editingTransaction ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch mới'}}
                </h3>
                <button class="close-btn" (click)="closeTransactionModal()">✕</button>
              </div>
              <form (ngSubmit)="saveTransaction()" class="transaction-form">
                <div class="form-grid">
                  <div class="form-group">
                    <div class="form-label">Loại giao dịch</div>
                    <div class="type-selector">
                      <button type="button"
                        class="type-btn"
                        [class.active]="transactionForm.type === 'income'"
                        (click)="transactionForm.type = 'income'">
                        <span class="type-icon">📈</span>
                        Thu nhập
                      </button>
                      <button type="button"
                        class="type-btn"
                        [class.active]="transactionForm.type === 'expense'"
                        (click)="transactionForm.type = 'expense'">
                        <span class="type-icon">📉</span>
                        Chi phí
                      </button>
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="category" class="form-label">Danh mục</label>
                    <select id="category" [(ngModel)]="transactionForm.category" name="category" class="form-input" required>
                      <option value="">Chọn danh mục</option>
                      @for (cat of getCategories(); track cat) {
                        <option [value]="cat.value">{{cat.label}}</option>
                      }
                    </select>
                  </div>
                  <div class="form-group full-width">
                    <label for="description" class="form-label">Mô tả</label>
                    <input id="description" type="text"
                      [(ngModel)]="transactionForm.description"
                      name="description"
                      class="form-input"
                      placeholder="Nhập mô tả giao dịch..."
                      required>
                    </div>
                    <div class="form-group">
                      <label for="amount" class="form-label">Số tiền (VNĐ)</label>
                      <input id="amount" type="number"
                        [(ngModel)]="transactionForm.amount"
                        name="amount"
                        class="form-input amount-input"
                        placeholder="0"
                        min="0"
                        step="1000"
                        required>
                      </div>
                      <div class="form-group">
                        <label for="transactionDate" class="form-label">Ngày giao dịch</label>
                        <input id="transactionDate" type="date"
                          [(ngModel)]="transactionForm.date"
                          name="date"
                          class="form-input"
                          required>
                        </div>
                      </div>
                      <div class="modal-actions">
                        <button type="button" class="btn-secondary" (click)="closeTransactionModal()">
                          Hủy
                        </button>
                        <button type="submit" class="btn-primary">
                          <span class="btn-icon">💾</span>
                          {{editingTransaction ? 'Cập nhật' : 'Thêm giao dịch'}}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              }
            </ng-container>
          </div>
    `,
  styleUrl: './fund.component.css'
})
export class FundComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);
  private fundTransactionService = inject(FundTransactionService);
  private logger = inject(LoggerService);
  private subscription?: Subscription;
  private permission = inject(PermissionService);
  canEdit = false;

  // Data properties
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  matchHistory: HistoryEntry[] = [];
  
  fundSummary: FundSummary = {
    currentBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    transactionCount: 0,
    matchTotalIncome: 0,
    matchTotalExpenses: 0,
    grandTotalIncome: 0,
    grandTotalExpenses: 0,
    monthlyProfit: 0
  };

  // UI state
  showAddTransaction = false;
  editingTransaction: Transaction | null = null;
  selectedFilter = 'all';

  // Form data
  transactionForm: Partial<Transaction> = {
    type: 'income',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    category: '',
    description: ''
  };

  ngOnInit() {
    // Deferred Firebase listeners: attach fund & history listeners only when Fund route is active
    this.firebaseService.attachFundListener();
    // History might be needed for match-related financial summaries
    this.firebaseService.attachHistoryListener();
    // Statistics may be displayed or computed within fund summaries
    this.firebaseService.attachStatisticsListener();
    this.loadData();
    this.subscribeToMatchHistory();
    this.permission.canEditChanges().subscribe(can=>{ this.canEdit=can; });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  private loadData() {
    try {
      this.transactions = this.fundTransactionService.loadTransactions();
      this.logger.info('Loaded transactions from storage', this.transactions);
    } catch (err) {
      this.logger.error('Failed to load transactions', err);
      this.transactions = [];
    }
    this.filterTransactions();
    this.calculateSummary();
  }

  private subscribeToMatchHistory() {
    this.subscription = this.firebaseService.history$.subscribe(matchHistory => {
      this.matchHistory = matchHistory;
      this.calculateMatchHistoryBalance();
      this.calculateSummary();
    });
  }

  private calculateMatchHistoryBalance() {
    let totalIncome = 0;
    let totalExpenses = 0;

    this.matchHistory.forEach(match => {
      totalIncome += match.thu || 0;
      totalExpenses += (match.chi_san || 0) + (match.chi_trongtai || 0) + 
                      (match.chi_khac || 0) + (match.chi_nuoc || 0) + 
                      (match.chi_dilai || 0) + (match.chi_anuong || 0);
    });

    this.fundSummary.matchTotalIncome = totalIncome;
    this.fundSummary.matchTotalExpenses = totalExpenses;
  }

  private calculateSummary() {
    // Calculate transaction totals
    this.fundSummary.totalIncome = this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    this.fundSummary.totalExpenses = this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    this.fundSummary.transactionCount = this.transactions.length;

    // Calculate grand totals
    this.fundSummary.grandTotalIncome = this.fundSummary.totalIncome + this.fundSummary.matchTotalIncome;
    this.fundSummary.grandTotalExpenses = this.fundSummary.totalExpenses + this.fundSummary.matchTotalExpenses;

    // Calculate current balance
    this.fundSummary.currentBalance = this.fundSummary.grandTotalIncome - this.fundSummary.grandTotalExpenses;

    // Calculate monthly profit (simplified)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyIncome = this.transactions
      .filter(t => t.type === 'income' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
      .reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpenses = this.transactions
      .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
      .reduce((sum, t) => sum + t.amount, 0);

    this.fundSummary.monthlyProfit = monthlyIncome - monthlyExpenses;
  }

  filterTransactions() {
    let filtered = [...this.transactions];

    switch (this.selectedFilter) {
      case 'income':
        filtered = filtered.filter(t => t.type === 'income');
        break;
      case 'expense':
        filtered = filtered.filter(t => t.type === 'expense');
        break;
      case 'this-month': {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        filtered = filtered.filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        break;
      }
    }

    this.filteredTransactions = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  quickAddIncome() {
    if(!this.canEdit) return;
    this.transactionForm = {
      type: 'income',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: 'match-fee',
      description: ''
    };
    this.showAddTransaction = true;
  }

  quickAddExpense() {
    if(!this.canEdit) return;
    this.transactionForm = {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: 'field-rental',
      description: ''
    };
    this.showAddTransaction = true;
  }

  generateReport() {
    // Implement report generation
    console.log('Generating report...');
  }

  syncWithMatches() {
    // Implement match synchronization
    console.log('Syncing with matches...');
  }

  exportTransactions() {
    // Implement export functionality
    console.log('Exporting transactions...');
  }

  saveTransaction() {
    if(!this.canEdit) return;
    if (!this.transactionForm.category || !this.transactionForm.description || !this.transactionForm.amount) {
      this.logger.warn('Transaction form is incomplete', this.transactionForm);
      return;
    }
    try {
      const transaction: FundTransaction = {
        id: this.editingTransaction?.id || this.generateId(),
        date: this.transactionForm.date!,
        type: this.transactionForm.type as 'income' | 'expense',
        category: this.transactionForm.category!,
        description: this.transactionForm.description!,
        amount: Number(this.transactionForm.amount)
      };
      if (this.editingTransaction) {
        this.transactions = this.fundTransactionService.updateTransaction(this.transactions, transaction);
        this.logger.info('Updated transaction', transaction);
      } else {
        this.transactions = this.fundTransactionService.addTransaction(this.transactions, transaction);
        this.logger.info('Added new transaction', transaction);
      }
      this.fundTransactionService.saveTransactions(this.transactions);
      this.logger.success('Transactions saved');
    } catch (err) {
      this.logger.error('Failed to save transaction', err, this.transactionForm);
    }
    this.calculateSummary();
    this.filterTransactions();
    this.closeTransactionModal();
  }

  editTransaction(transaction: Transaction) {
    if(!this.canEdit) return;
    this.editingTransaction = transaction;
    this.transactionForm = { ...transaction };
    this.showAddTransaction = true;
  }

  deleteTransaction(transaction: Transaction) {
    if(!this.canEdit) return;
    if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
      try {
        this.transactions = this.fundTransactionService.deleteTransaction(this.transactions, transaction.id);
        this.fundTransactionService.saveTransactions(this.transactions);
        this.logger.info('Deleted transaction', transaction);
        this.logger.success('Transactions saved after delete');
      } catch (err) {
        this.logger.error('Failed to delete transaction', err, transaction);
      }
      this.calculateSummary();
      this.filterTransactions();
    }
  }

  closeTransactionModal() {
    this.showAddTransaction = false;
    this.editingTransaction = null;
    this.transactionForm = {
      type: 'income',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: '',
      description: ''
    };
  }

  getCategories() {
    return FUND_CATEGORIES;
  }

  trackTransaction(index: number, transaction: Transaction): string {
    return transaction.id;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat(FUND_DATE_FORMAT, {
      style: 'currency',
      currency: FUND_CURRENCY,
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(FUND_DATE_FORMAT);
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}