"""Search for the tuned parameters used in the notebook's Models cell.

Uses 3-fold cross-validation on the TRAINING set only (the test set is never
seen here). Run once; the best values were copied by hand into the notebook's
Models cell and into train_model.py. Takes about 15-30 minutes.

    python tune_search.py
"""
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import GridSearchCV
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

from airbnb_data import load_clean_data, split_data

# LinearRegression has no parameters worth tuning, so it is not searched.
SEARCHES = {
    "RandomForestRegressor": (
        RandomForestRegressor(n_estimators=300, random_state=42),
        {"min_samples_leaf": [1, 2, 4], "max_features": [0.2, 0.33, 0.5]},
    ),
    "KNeighborsRegressor": (
        make_pipeline(StandardScaler(), KNeighborsRegressor()),
        {"kneighborsregressor__n_neighbors": [25, 40, 60, 80], "kneighborsregressor__weights": ["uniform", "distance"]},
    ),
    "GradientBoostingRegressor": (
        GradientBoostingRegressor(random_state=42),
        {"n_estimators": [200, 300, 500], "learning_rate": [0.03, 0.05], "max_depth": [5, 7]},
    ),
    "SVR": (
        make_pipeline(StandardScaler(), SVR()),
        {"svr__C": [3, 10], "svr__epsilon": [0.2, 0.3]},
    ),
}


def main():
    X_train, X_test, Y_train, Y_test = split_data(load_clean_data())
    for name, (model, grid) in SEARCHES.items():
        search = GridSearchCV(model, grid, cv=3, scoring="r2", n_jobs=-1)
        search.fit(X_train, Y_train)
        print(f"{name}: best CV R2 = {search.best_score_:.4f}, params = {search.best_params_}", flush=True)


if __name__ == "__main__":
    main()
