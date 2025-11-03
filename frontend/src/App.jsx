// App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import LoginForm from "./page/Login/LoginForm.jsx";
import BrockerDetailPage from './page/User/BrockerDetailPage.jsx';
import CustomerDetailsPage from './page/User/CutomerDetailPage.jsx';
import Watchlist from './page/WatchList/Watchlist.jsx';
import Layout from './page/Layout';
import Portfolio from './page/Portfolio/Portfolio.jsx';
import FundPage from "./page/Funds/FundView.jsx";
import Orders from './page/Orders/Order.jsx';
import Profile from './page/Profile/Profile.jsx';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LoginForm />} />
                <Route path="/brockerDetail" element={<BrockerDetailPage />} />
                <Route path="/customerDetail" element={<CustomerDetailsPage />} />


                <Route path="/broker/:brokerId/customerDetail" element={<CustomerDetailsPage />} />




                <Route
                    path="/watchlist"
                    element={
                        <Layout>
                            <Watchlist />
                        </Layout>
                    }
                />

                <Route
                    path="/portfolio"
                    element={
                        <Layout>
                            <Portfolio />
                        </Layout>
                    }
                />

                <Route
                    path="/funds"
                    element={
                        <Layout>
                            <FundPage />
                        </Layout>
                    }
                />

                <Route
                    path="/orders"
                    element={
                        <Layout>
                            <Orders />
                        </Layout>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <Layout>
                            <Profile />
                        </Layout>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
